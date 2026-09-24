import { testClient } from "hono/testing";
import { beforeEach, describe, expect, it } from "vitest";

import { createTestApp } from "@/lib/create-app";
import { mockSetDlrStatus, resetMockState } from "@/routes/sms-mock";
import router from "@/routes/sms.index";

const client = testClient(createTestApp(router));

beforeEach(() => {
  resetMockState();
});

const SEND = {
  msg: "mock test message",
  numbers: "+256700000001",
  dlr_url: "https://example.com/dlr",
  category: "promotional",
};

describe("dLR states (TC06/TC07)", () => {
  it("reports pending after send, then delivered after the mock advances it", async () => {
    const sendRes = await client.v3.api.send_sms.$post({ json: SEND });
    const msgId = (await sendRes.json() as unknown as { msg_id: string }).msg_id;

    const pending = await client.v3.api.dlr.$post({ json: { msgId } });
    expect(pending.status).toBe(200);
    expect((await pending.json() as unknown as { status: string }).status).toBe("pending");

    const advance = await mockSetDlrStatus(msgId, "delivered");
    expect(advance.status).toBe(200);

    const delivered = await client.v3.api.dlr.$post({ json: { msgId } });
    expect((await delivered.json() as unknown as { status: string }).status).toBe("delivered");
  });

  it("reports failed after the mock marks the message failed", async () => {
    const sendRes = await client.v3.api.send_sms.$post({ json: SEND });
    const msgId = (await sendRes.json() as unknown as { msg_id: string }).msg_id;

    await mockSetDlrStatus(msgId, "failed");

    const res = await client.v3.api.dlr.$post({ json: { msgId } });
    expect((await res.json() as unknown as { status: string }).status).toBe("failed");
  });

  it("returns 404 for a msgId that was never sent", async () => {
    const res = await client.v3.api.dlr.$post({
      json: { msgId: "never-sent-message" },
    });

    expect(res.status).toBe(404);
  });

  it("keeps DLR status after a restart (reads from the database)", async () => {
    const sendRes = await client.v3.api.send_sms.$post({ json: SEND });
    const msgId = (await sendRes.json() as unknown as { msg_id: string }).msg_id;

    await mockSetDlrStatus(msgId, "delivered");

    resetMockState();

    const res = await client.v3.api.dlr.$post({ json: { msgId } });
    expect((await res.json() as unknown as { status: string }).status).toBe("delivered");
  });
});

describe("mock state reset", () => {
  it("clears state so each send gets a fresh random msg id", async () => {
    const first = await client.v3.api.send_sms.$post({ json: SEND });
    const firstData = await first.json() as { msg_id: string };

    resetMockState();

    const res = await client.v3.api.send_sms.$post({ json: SEND });
    const data = await res.json() as { msg_id: string };
    expect(data.msg_id).toMatch(/^[0-9A-F]{8}$/);
    expect(data.msg_id).not.toBe(firstData.msg_id);
  });
});

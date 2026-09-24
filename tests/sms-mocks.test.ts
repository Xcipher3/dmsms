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
  numbers: "+256700990001",
  dlr_url: "https://example.com/dlr",
  category: "promotional",
};

describe("blasta SMS mock responses", () => {
  it("returns the sendSms mock payload", async () => {
    const response = await client.v3.api.send_sms.$post({ json: SEND });

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({
      msg_id: expect.stringMatching(/^[0-9A-F]{8}$/),
      status_code: "201",
      description: "Message accepted",
    });
  });

  it("returns 400 with the sendSms failure shape on invalid body", async () => {
    const response = await client.v3.api.send_sms.$post({
      json: {
        msg: "",
        numbers: "",
        dlr_url: "",
        category: "",
      },
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      msg_id: "",
      status_code: "400",
      description: "Invalid message format",
    });
  });

  it("returns the getDlr mock payload across the message lifecycle", async () => {
    const send = await client.v3.api.send_sms.$post({ json: SEND });
    const { msg_id } = await send.json() as unknown as { msg_id: string };

    const pending = await client.v3.api.dlr.$post({ json: { msgId: msg_id } });
    expect(pending.status).toBe(200);
    expect(await pending.json()).toMatchObject({
      msg_id,
      status: "pending",
      status_code: "200",
      description: "Delivery pending",
    });

    await mockSetDlrStatus(msg_id, "delivered");

    const delivered = await client.v3.api.dlr.$post({ json: { msgId: msg_id } });
    expect(delivered.status).toBe(200);
    expect(await delivered.json()).toMatchObject({
      msg_id,
      status: "delivered",
      status_code: "200",
      description: "Delivered",
    });
  });

  it("returns 404 for a msgId that was never sent", async () => {
    const response = await client.v3.api.dlr.$post({ json: { msgId: "mock-msg-999" } });

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ message: "Not Found" });
  });

  it("returns submitted_at in east african time", async () => {
    const send = await client.v3.api.send_sms.$post({ json: SEND });
    const { msg_id } = await send.json() as unknown as { msg_id: string };

    const dlr = await client.v3.api.dlr.$post({ json: { msgId: msg_id } });
    const body = await dlr.json() as unknown as { submitted_at: string };
    expect(body.submitted_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}\+03:00$/);
  });
});

import { testClient } from "hono/testing";
import { beforeEach, describe, expect, it } from "vitest";

import { createTestApp } from "@/lib/create-app";
import router from "@/routes/sms.index";
import { mockSetDlrStatus, resetMockState } from "@/routes/sms-mock";

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

async function issueToken(username = "testuser", password = "testpass") {
  const res = await client.v3.api.get_token.$post({ json: { username, password } });
  if (res.status !== 201) {
    throw new Error(`token request failed with status ${res.status}`);
  }
  const data = await res.json() as { access_token: string };
  return data.access_token;
}

describe("getToken credential validation (TC09)", () => {
  it("issues a token for the configured credentials", async () => {
    const res = await client.v3.api.get_token.$post({
      json: { username: "testuser", password: "testpass" },
    });

    expect(res.status).toBe(201);
    const data = await res.json() as Record<string, unknown>;
    expect(String(data.access_token)).toHaveLength(7);
    expect(data.status_code).toBe("201");
  });

  it("rejects invalid credentials with 401 and no token", async () => {
    const res = await client.v3.api.get_token.$post({
      json: { username: "bogus", password: "bogus" },
    });

    expect(res.status).toBe(401);
    const data = await res.json() as Record<string, unknown>;
    expect(data.access_token).toBe("");
    expect(data.status_code).toBe("401");
  });
});

describe("auth enforcement on protected endpoints (TC19)", () => {
  it("rejects send without any token", async () => {
    const res = await client.v3.api.send_sms.$post({ json: SEND, header: {} });
    expect(res.status).toBe(401);
  });

  it("rejects send with an invalid token", async () => {
    const res = await client.v3.api.send_sms.$post({ json: SEND, header: { authToken: "not-a-real-token" } });
    expect(res.status).toBe(401);
  });

  it("accepts send with a token issued by getToken (and still returns 201 when DB is unavailable)", async () => {
    const token = await issueToken();
    const res = await client.v3.api.send_sms.$post({ json: SEND, header: { authToken: token } });

    expect(res.status).toBe(201);
    const data = await res.json() as Record<string, unknown>;
    expect(data.status_code).toBe("201");
    expect(String(data.msg_id)).toMatch(/^mock-msg-/);
  });

  it("rejects opt-out without a valid token", async () => {
    const res = await client.v3.api.opt_out.$post({
      json: { numbers: "+256700000099", category: "promotional", reason: "r" },
      header: {},
    });
    expect(res.status).toBe(401);
  });

  it("rejects list-opt-outs without a valid token", async () => {
    const res = await client.v3.api.opt_outs.$get({ header: {} });
    expect(res.status).toBe(401);
  });
});

describe("dLR states (TC06/TC07)", () => {
  it("reports pending after send, then delivered after the mock advances it", async () => {
    const token = await issueToken();
    const sendRes = await client.v3.api.send_sms.$post({ json: SEND, header: { authToken: token } });
    const sent = await sendRes.json() as unknown as { msg_id: string };
    const msgId = sent.msg_id;

    const pending = await client.v3.api.dlr.$post({ json: { msgId }, header: { authToken: token } });
    expect(pending.status).toBe(200);
    expect((await pending.json() as unknown as { status: string }).status).toBe("pending");

    const advance = mockSetDlrStatus(msgId, "delivered");
    expect(advance.status).toBe(200);

    const delivered = await client.v3.api.dlr.$post({ json: { msgId }, header: { authToken: token } });
    expect((await delivered.json() as unknown as { status: string }).status).toBe("delivered");
  });

  it("reports failed after the mock marks the message failed", async () => {
    const token = await issueToken();
    const sendRes = await client.v3.api.send_sms.$post({ json: SEND, header: { authToken: token } });
    const msgId = (await sendRes.json() as unknown as { msg_id: string }).msg_id;

    mockSetDlrStatus(msgId, "failed");

    const res = await client.v3.api.dlr.$post({ json: { msgId }, header: { authToken: token } });
    expect((await res.json() as unknown as { status: string }).status).toBe("failed");
  });

  it("returns 404 for a msgId that was never sent", async () => {
    const token = await issueToken();
    const res = await client.v3.api.dlr.$post({
      json: { msgId: "never-sent-message" },
      header: { authToken: token },
    });

    expect(res.status).toBe(404);
  });
});

describe("opt-out deduplication (TC15)", () => {
  it("reports already_listed on the second opt-out for the same number+category", async () => {
    const token = await issueToken();
    const body = { numbers: "+256700000200", category: "promotional", reason: "r" };

    const first = await client.v3.api.opt_out.$post({ json: body, header: { authToken: token } });
    expect((await first.json() as { added: number }).added).toBe(1);

    const second = await client.v3.api.opt_out.$post({ json: body, header: { authToken: token } });
    const secondBody = await second.json() as { added: number; already_listed: number };
    expect(secondBody.added).toBe(0);
    expect(secondBody.already_listed).toBe(1);
  });
});

describe("opt-in deduplication (TC16)", () => {
  it("reports already_listed on the second opt-in for the same number+category", async () => {
    const token = await issueToken();
    const body = { numbers: "+256700000300", category: "promotional", reason: "r" };

    const first = await client.v3.api.opt_in.$post({ json: body, header: { authToken: token } });
    expect((await first.json() as { added: number }).added).toBe(1);

    const second = await client.v3.api.opt_in.$post({ json: body, header: { authToken: token } });
    const secondBody = await second.json() as { added: number; already_listed: number };
    expect(secondBody.added).toBe(0);
    expect(secondBody.already_listed).toBe(1);
  });
});

describe("list opt-outs reflects mock state", () => {
  it("returns an empty array when no opt-outs exist", async () => {
    const token = await issueToken();
    const res = await client.v3.api.opt_outs.$get({ header: { authToken: token } });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it("returns the opted-out number after an opt-out", async () => {
    const token = await issueToken();
    await client.v3.api.opt_out.$post({
      json: { numbers: "+256700000400", category: "promotional", reason: "r" },
      header: { authToken: token },
    });

    const res = await client.v3.api.opt_outs.$get({ header: { authToken: token } });
    expect(res.status).toBe(200);
    const data = await res.json() as Array<{ phone_number: string }>;
    expect(data).toHaveLength(1);
    expect(data[0].phone_number).toBe("+256700000400");
  });
});

describe("mock state reset", () => {
  it("clears state so an opt-out can be added again", async () => {
    const token = await issueToken();
    const body = { numbers: "+256700000500", category: "promotional", reason: "r" };

    await client.v3.api.opt_out.$post({ json: body, header: { authToken: token } });

    resetMockState();

    const freshToken = await issueToken();
    const after = await client.v3.api.opt_out.$post({ json: body, header: { authToken: freshToken } });
    expect((await after.json() as { added: number }).added).toBe(1);
  });
});

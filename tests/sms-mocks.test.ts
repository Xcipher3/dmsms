import { testClient } from "hono/testing";
import { beforeEach, describe, expect, it } from "vitest";

import { createTestApp } from "@/lib/create-app";
import router from "@/routes/sms.index";

const client = testClient(createTestApp(router));

beforeEach(async () => {
  await router.request("/mock/reset", { method: "POST" });
});

async function issueToken() {
  const response = await client.v3.v3.api.get_token.$post({
    json: { username: "testuser", password: "testpass" },
  });
  const data = await response.json() as { access_token: string };
  return data.access_token;
}

describe("blasta SMS mock responses", () => {
  it("returns the sendSms mock payload", async () => {
    const token = await issueToken();
    const response = await client.v3.v3.api.send_sms.$post({
      json: {
        msg: "mock test message",
        numbers: "+256700990001",
        dlr_url: "https://example.com/dlr",
        category: "promotional",
      },
      header: { authToken: token },
    });

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({
      msg_id: "mock-msg-001",
      status_code: "201",
      description: "Message accepted",
    });
  });

  it("returns 400 with the sendSms failure shape on invalid body", async () => {
    const response = await client.v3.v3.api.send_sms.$post({
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
    const token = await issueToken();
    const send = await client.v3.v3.api.send_sms.$post({
      json: {
        msg: "mock test message",
        numbers: "+256700990001",
        dlr_url: "https://example.com/dlr",
        category: "promotional",
      },
      header: { authToken: token },
    });
    const { msg_id } = await send.json() as unknown as { msg_id: string };

    const pending = await client.v3.v3.api.dlr.$post({ json: { msgId: msg_id }, header: { authToken: token } });
    expect(pending.status).toBe(200);
    expect(await pending.json()).toMatchObject({
      msg_id,
      status: "pending",
      status_code: "200",
      description: "Delivery pending",
    });

    await router.request(`/mock/dlr/${msg_id}/deliver`, { method: "POST" });

    const delivered = await client.v3.v3.api.dlr.$post({ json: { msgId: msg_id }, header: { authToken: token } });
    expect(delivered.status).toBe(200);
    expect(await delivered.json()).toMatchObject({
      msg_id,
      status: "delivered",
      status_code: "200",
      description: "Delivered",
    });
  });

  it("returns 404 for a msgId that was never sent", async () => {
    const token = await issueToken();
    const response = await client.v3.v3.api.dlr.$post({ json: { msgId: "mock-msg-999" }, header: { authToken: token } });

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ message: "Not Found" });
  });

  it("returns the getToken mock payload", async () => {
    const response = await client.v3.v3.api.get_token.$post({
      json: { username: "testuser", password: "testpass" },
    });

    expect(response.status).toBe(201);
    const data = await response.json() as Record<string, unknown>;
    expect(data).toMatchObject({
      access_token: "mock-token-123",
      username: "testuser",
      status_code: "201",
    });
  });

  it("returns the optOut mock payload", async () => {
    const token = await issueToken();
    const response = await client.v3.v3.api.opt_out.$post({
      json: {
        numbers: "+256700990002",
        category: "promotional",
        reason: "mock opt-out",
      },
      header: { authToken: token },
    });

    expect(response.status).toBe(200);
    const data = await response.json() as Record<string, unknown>;
    expect(data).toMatchObject({ added: 1, status_code: 200, description: "Opted out" });
  });

  it("returns the optIn mock payload", async () => {
    const token = await issueToken();
    const response = await client.v3.v3.api.opt_in.$post({
      json: {
        numbers: "+256700990003",
        category: "promotional",
        reason: "mock opt-in",
      },
      header: { authToken: token },
    });

    expect(response.status).toBe(200);
    const data = await response.json() as Record<string, unknown>;
    expect(data).toMatchObject({ added: 1, status_code: 200, description: "Opted in" });
  });

  it("returns the listOptOuts mock array reflecting mock state", async () => {
    const token = await issueToken();

    const empty = await client.v3.v3.api.opt_outs.$get({ header: { authToken: token } });
    expect(empty.status).toBe(200);
    expect(await empty.json()).toEqual([]);

    await client.v3.v3.api.opt_out.$post({
      json: {
        numbers: "+256700990004",
        category: "promotional",
        reason: "mock opt-out",
      },
      header: { authToken: token },
    });

    const filled = await client.v3.v3.api.opt_outs.$get({ header: { authToken: token } });
    const data = await filled.json() as { phone_number: string }[];
    expect(data.length).toBe(1);
    expect(data[0].phone_number).toBe("+256700990004");
  });
});

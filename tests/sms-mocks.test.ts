import { eq } from "drizzle-orm";
import { testClient } from "hono/testing";
import { describe, expect, it } from "vitest";

import db from "@/db";
import { authTokens, optIns, optOuts, requestLogs, smsMessages } from "@/db/schema";
import { createTestApp } from "@/lib/create-app";
import router from "@/routes/sms.index";

const client = testClient(createTestApp(router));

async function cleanup(response: Response) {
  const requestId = response.headers.get("x-request-id");
  if (requestId) {
    await db.delete(requestLogs).where(eq(requestLogs.requestId, requestId));
  }
}

describe("blasta SMS mock responses", () => {
  it("returns the sendSms mock payload", async () => {
    const response = await client.sms.send.$post({
      json: {
        msg: "mock test message",
        numbers: "+256700990001",
        dlr_url: "https://example.com/dlr",
        category: "promotional",
      },
    });

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({
      msg_id: "mock-msg-001",
      status_code: "201",
      description: "Message accepted",
    });

    await db.delete(smsMessages).where(eq(smsMessages.msgId, "mock-msg-001"));
    await cleanup(response);
  });

  it("returns 400 with the sendSms failure shape on invalid body", async () => {
    const response = await client.sms.send.$post({
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

    await cleanup(response);
  });

  it("returns the getDlr mock payload", async () => {
    const response = await client.sms.dlr.$post({ json: { msgId: "mock-msg-001" } });

    expect(response.status).toBe(200);
    const data = await response.json() as Record<string, unknown>;
    expect(data).toMatchObject({
      msg_id: "mock-msg-001",
      status: "delivered",
      status_code: "200",
      description: "Delivered",
    });

    await cleanup(response);
  });

  it("returns the getToken mock payload and persists the token", async () => {
    const response = await client.sms.token.$post({
      json: { username: "testuser", password: "supersecret" },
    });

    expect(response.status).toBe(201);
    const data = await response.json() as Record<string, unknown>;
    expect(data).toMatchObject({
      access_token: "mock-token-123",
      username: "testuser",
      status_code: "201",
    });

    await db.delete(authTokens).where(eq(authTokens.accessToken, "mock-token-123"));
    await cleanup(response);
  });

  it("returns the optOut mock payload", async () => {
    const response = await client.sms["opt-out"].$post({
      json: {
        numbers: "+256700990002",
        category: "promotional",
        reason: "mock opt-out",
      },
    });

    expect(response.status).toBe(200);
    const data = await response.json() as Record<string, unknown>;
    expect(data).toMatchObject({ added: 1, status_code: 200, description: "Opted out" });

    await db.delete(optOuts).where(eq(optOuts.phoneNumber, "+256700990002"));
    await cleanup(response);
  });

  it("returns the optIn mock payload", async () => {
    const response = await client.sms["opt-in"].$post({
      json: {
        numbers: "+256700990003",
        category: "promotional",
        reason: "mock opt-in",
      },
    });

    expect(response.status).toBe(200);
    const data = await response.json() as Record<string, unknown>;
    expect(data).toMatchObject({ added: 1, status_code: 200, description: "Opted in" });

    await db.delete(optIns).where(eq(optIns.phoneNumber, "+256700990003"));
    await cleanup(response);
  });

  it("returns the listOptOuts mock array", async () => {
    const response = await client.sms["opt-outs"].$get();

    expect(response.status).toBe(200);
    const data = await response.json() as unknown[];
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);

    await cleanup(response);
  });
});

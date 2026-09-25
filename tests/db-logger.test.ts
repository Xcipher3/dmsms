import { eq } from "drizzle-orm";
import { testClient } from "hono/testing";
import { describe, expect, it } from "vitest";

import db from "@/db";
import { apiRequests, smsMessages } from "@/db/schema";
import { createTestApp } from "@/lib/create-app";
import index from "@/routes/index.route";
import router from "@/routes/sms.index";

const client = testClient(createTestApp(index));
const smsClient = testClient(createTestApp(router));

async function waitForLogByRequestId(requestId: string, timeoutMs = 10_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const rows = await db.select().from(apiRequests).where(eq(apiRequests.requestId, requestId)).limit(1);
    if (rows.length > 0)
      return rows[0];
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error("Timed out waiting for persisted request log");
}

describe("db logger", () => {
  it("stores requestBody=null and responseBody JSON for GET", { timeout: 60_000 }, async () => {
    const res = await client.index.$get({});
    expect(res.status).toBe(200);

    const requestId = res.headers.get("x-request-id")!;
    const row = await waitForLogByRequestId(requestId);

    expect(row.method).toBe("GET");
    expect(row.requestBody).toBeNull();
    expect(row.responseBody).toEqual({ message: "Blasta SMS API" });

    await db.delete(apiRequests).where(eq(apiRequests.id, row.id));
  });

  it("stores requestBody and responseBody JSON for POST /v3/api/send_sms/", { timeout: 60_000 }, async () => {
    const payload = {
      msg: "hello from db-logger test",
      numbers: "+256700999999",
      dlr_url: "https://example.com/dlr",
      category: "marketing",
    };
    const res = await smsClient.v3.api.send_sms.$post({ header: {}, json: payload });
    expect(res.status).toBe(201);

    const requestId = res.headers.get("x-request-id")!;
    const row = await waitForLogByRequestId(requestId);

    expect(row.method).toBe("POST");
    expect(row.path).toBe("/v3/api/send_sms");
    expect(row.requestBody).toEqual(payload);
    expect(row.responseBody).toEqual(
      expect.objectContaining({
        msg_id: expect.any(String),
        status_code: expect.any(String),
      }),
    );

    const msgId = (row.responseBody as Record<string, unknown>).msg_id as string;
    await db.delete(apiRequests).where(eq(apiRequests.id, row.id));
    await db.delete(smsMessages).where(eq(smsMessages.msgId, msgId));
  });

  it("redacts the authToken header", { timeout: 60_000 }, async () => {
    const res = await smsClient.v3.api.send_sms.$post({
      json: {
        msg: "header redaction test",
        numbers: "+256700999999",
        dlr_url: "https://example.com/dlr",
        category: "marketing",
      },
      header: { authToken: "super-secret-token" },
    });
    expect(res.status).toBe(201);

    const requestId = res.headers.get("x-request-id")!;
    const row = await waitForLogByRequestId(requestId);

    const headers = row.headers as Record<string, string>;
    expect(headers.authtoken).toBe("[REDACTED]");
    expect(JSON.stringify(headers)).not.toContain("super-secret-token");

    const msgId = (row.responseBody as Record<string, unknown>).msg_id as string;
    await db.delete(apiRequests).where(eq(apiRequests.id, row.id));
    await db.delete(smsMessages).where(eq(smsMessages.msgId, msgId));
  });
});

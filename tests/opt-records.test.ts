import { eq } from "drizzle-orm";
import { testClient } from "hono/testing";
import { describe, expect, it } from "vitest";

import db from "@/db";
import { optIns, optOuts } from "@/db/schema";
import { createTestApp } from "@/lib/create-app";
import router from "@/routes/sms.index";

const client = testClient(createTestApp(router));

async function issueToken() {
  const response = await client.v3.api.get_token.$post({
    json: { username: "testuser", password: "testpass" },
  });
  const data = await response.json() as { access_token: string };
  return data.access_token;
}

async function waitForRow(
  query: () => Promise<Array<Record<string, unknown>>>,
  timeoutMs = 10_000,
) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const rows = await query();
    if (rows.length > 0)
      return rows[0];
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error("Timed out waiting for DB row");
}

describe("opt-in / opt-out records", () => {
  it("persists opt-in to the opt_ins table", { timeout: 60_000 }, async () => {
    const token = await issueToken();
    const response = await client.v3.api.opt_in.$post({
      json: {
        numbers: "+256700900001",
        category: "marketing",
        reason: "User requested",
      },
      header: { authToken: token },
    });

    expect(response.status).toBe(200);

    const row = await waitForRow(() =>
      db.select().from(optIns).where(eq(optIns.phoneNumber, "+256700900001")).limit(1));

    expect(row).toMatchObject({
      phoneNumber: "+256700900001",
      category: "marketing",
      reason: "User requested",
      source: "api",
    });

    await db.delete(optIns).where(eq(optIns.id, row.id as number));
  });

  it("persists opt-out to the opt_outs table", { timeout: 60_000 }, async () => {
    const token = await issueToken();
    const response = await client.v3.api.opt_out.$post({
      json: {
        numbers: "+256700900002",
        category: "marketing",
        reason: "User unsubscribed",
      },
      header: { authToken: token },
    });

    expect(response.status).toBe(200);

    const row = await waitForRow(() =>
      db.select().from(optOuts).where(eq(optOuts.phoneNumber, "+256700900002")).limit(1));

    expect(row).toMatchObject({
      phoneNumber: "+256700900002",
      category: "marketing",
      reason: "User unsubscribed",
      source: "api",
    });

    await db.delete(optOuts).where(eq(optOuts.id, row.id as number));
  });
});

import { eq } from "drizzle-orm";
import { testClient } from "hono/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { hashToken } from "@/lib/hash";
import db from "@/db";
import { authTokens, smsMessages } from "@/db/schema";
import env from "@/env";
import { createTestApp } from "@/lib/create-app";
import router from "@/routes/sms.index";

const client = testClient(createTestApp(router));

const SEND = {
  msg: "Real message",
  numbers: "+256770123456",
  dlr_url: "https://example.com/dlr",
  category: "promotional",
};

interface BlastaReply {
  status: number;
  body: Record<string, unknown>;
}

interface CapturedCall {
  url: string;
  init?: RequestInit;
}

const realFetch = globalThis.fetch;
let blastaReply: BlastaReply;
let blastaUnreachable = false;
let captured: CapturedCall[] = [];

beforeEach(async () => {
  vi.stubEnv("NODE_ENV", "development");
  blastaUnreachable = false;
  captured = [];
  await db.insert(authTokens).values({
    username: "test-user",
    accessToken: hashToken("token-abc"),
    firstName: "Test",
    lastName: "User",
  }).onConflictDoUpdate({
    target: authTokens.username,
    set: {
      accessToken: hashToken("token-abc"),
      firstName: "Test",
      lastName: "User",
    },
  });
  await db.insert(authTokens).values({
    username: "test-user-bad",
    accessToken: hashToken("bad-token"),
    firstName: "Test",
    lastName: "User",
  }).onConflictDoUpdate({
    target: authTokens.username,
    set: {
      accessToken: hashToken("bad-token"),
      firstName: "Test",
      lastName: "User",
    },
  });
  await db.insert(authTokens).values({
    username: "test-user-stale",
    accessToken: hashToken("stale-token"),
    firstName: "Test",
    lastName: "User",
  }).onConflictDoUpdate({
    target: authTokens.username,
    set: {
      accessToken: hashToken("stale-token"),
      firstName: "Test",
      lastName: "User",
    },
  });
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (!url.startsWith(env.BLASTA_BASE_URL))
      return realFetch(input, init);
    captured.push({ url, init });
    if (blastaUnreachable)
      throw new TypeError("fetch failed");
    return new Response(JSON.stringify(blastaReply.body), {
      status: blastaReply.status,
      headers: { "Content-Type": "application/json" },
    });
  }));
});

afterEach(async () => {
  await db.delete(authTokens).where(eq(authTokens.username, "test-user"));
  await db.delete(authTokens).where(eq(authTokens.username, "test-user-bad"));
  await db.delete(authTokens).where(eq(authTokens.username, "test-user-stale"));
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function sentBody(index = 0): Record<string, unknown> {
  return JSON.parse(String(captured[index].init?.body)) as Record<string, unknown>;
}

function sentHeaders(index = 0): Record<string, string> {
  return captured[index].init?.headers as Record<string, string>;
}

describe("real Blasta mode", () => {
  describe("get_token", () => {
    it("forwards credentials to Blasta and returns the real access token", async () => {
      blastaReply = {
        status: 201,
        body: {
          access_token: "REALtoken123",
          first_name: "Enoc",
          last_name: "Stark",
          username: "enoc",
          description: "Token generated",
          status_code: "201",
        },
      };

      const response = await client.v3.api.get_token.$post({
        json: { username: "enoc", password: "secret" },
      });

      expect(response.status).toBe(201);
      expect(await response.json()).toEqual(blastaReply.body);
      expect(captured).toHaveLength(1);
      expect(captured[0].url).toBe(`${env.BLASTA_BASE_URL}/get_token/`);
      expect(captured[0].init?.method).toBe("POST");
      expect(sentBody()).toEqual({ username: "enoc", password: "secret" });

      const rows = await db.select().from(authTokens).where(eq(authTokens.username, "enoc"));
      expect(rows).toHaveLength(1);
      expect(rows[0].accessToken).toBe(hashToken("REALtoken123"));
      await db.delete(authTokens).where(eq(authTokens.username, "enoc"));
    });

    it("forwards Blasta's rejection", async () => {
      blastaReply = {
        status: 401,
        body: { access_token: "", description: "Invalid username or password", status_code: "401" },
      };

      const response = await client.v3.api.get_token.$post({
        json: { username: "enoc", password: "wrong" },
      });

      expect(response.status).toBe(401);
      expect(await response.json()).toEqual(blastaReply.body);
      expect(captured).toHaveLength(1);
      expect(captured[0].url).toBe(`${env.BLASTA_BASE_URL}/get_token/`);
    });

    it("maps Blasta's unknown-account 404 to 404 and forwards the body as-is", async () => {
      blastaReply = {
        status: 404,
        body: { error: "Account Not Found", description: "Account Does Not Exist.", status_code: 404 },
      };

      const response = await client.v3.api.get_token.$post({
        json: { username: "ghost", password: "nope" },
      });

      expect(response.status).toBe(404);
      expect(await response.json()).toEqual(blastaReply.body);
      expect(captured).toHaveLength(1);
      expect(captured[0].url).toBe(`${env.BLASTA_BASE_URL}/get_token/`);
    });
  });

  describe("send_sms", () => {
    it("forwards the Authorization header and payload, and records the real msg_id", async () => {
      blastaReply = {
        status: 201,
        body: { msg_id: "REAL-MSG-001", status_code: "201", description: "Message accepted" },
      };

      const response = await client.v3.api.send_sms.$post({
        json: SEND,
        header: { Authorization: "Bearer token-abc" },
      });

      expect(response.status).toBe(201);
      expect(await response.json()).toEqual(blastaReply.body);
      expect(captured).toHaveLength(1);
      expect(captured[0].url).toBe(`${env.BLASTA_BASE_URL}/send_sms/`);
      expect(sentHeaders().authToken).toBe("token-abc");
      expect(sentBody()).toEqual(SEND);

      const rows = await db.select().from(smsMessages).where(eq(smsMessages.msgId, "REAL-MSG-001"));
      expect(rows).toHaveLength(1);
      await db.delete(smsMessages).where(eq(smsMessages.msgId, "REAL-MSG-001"));
    });

    it("returns 401 when Blasta rejects the token", async () => {
      blastaReply = {
        status: 401,
        body: { msg_id: "", status_code: "401", description: "Invalid auth token" },
      };

      const response = await client.v3.api.send_sms.$post({
        json: SEND,
        header: { Authorization: "Bearer bad-token" },
      });

      expect(response.status).toBe(401);
      expect(await response.json()).toEqual(blastaReply.body);
      expect(captured).toHaveLength(1);
    });

    it("maps Blasta's 403 (invalid token) to 401 with its description", async () => {
      blastaReply = {
        status: 403,
        body: {
          error: "unauthenticated",
          description: "Invalid token type. Token must be a <class 'bytes'>",
          status_code: "403",
        },
      };

      const response = await client.v3.api.send_sms.$post({
        json: SEND,
        header: { Authorization: "Bearer stale-token" },
      });

      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({ status_code: 401, description: "Invalid token type. Token must be a <class 'bytes'>" });
      expect(captured).toHaveLength(1);
    });

    it("returns 502 when Blasta is unreachable", async () => {
      blastaUnreachable = true;

      const response = await client.v3.api.send_sms.$post({
        json: SEND,
        header: { Authorization: "Bearer token-abc" },
      });

      expect(response.status).toBe(502);
      expect(await response.json()).toEqual({
        msg_id: "",
        status_code: "502",
        description: "Blasta gateway unreachable",
      });
      expect(captured).toHaveLength(1);
    });
  });

  describe("dlr", () => {
    it("forwards msgId and authToken and returns Blasta's status", async () => {
      blastaReply = {
        status: 200,
        body: {
          msg_id: "REAL-MSG-001",
          submitted_at: "2026-09-24T21:00:00.000+03:00",
          status: "delivered",
          status_code: "200",
          description: "Delivered",
        },
      };

      const response = await client.v3.api.dlr.$post({
        json: { msgId: "REAL-MSG-001" },
        header: { Authorization: "Bearer token-abc" },
      });

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual(blastaReply.body);
      expect(captured).toHaveLength(1);
      expect(captured[0].url).toBe(`${env.BLASTA_BASE_URL}/dlr/`);
      expect(sentHeaders().authToken).toBe("token-abc");
      expect(sentBody()).toEqual({ msgId: "REAL-MSG-001" });
    });

    it("maps Blasta's 403 (invalid token) to 403 and forwards the body as-is", async () => {
      blastaReply = {
        status: 403,
        body: {
          error: "unauthenticated",
          description: "Invalid token type. Token must be a <class 'bytes'>",
          status_code: "403",
        },
      };

      const response = await client.v3.api.dlr.$post({
        json: { msgId: "REAL-MSG-001" },
        header: { Authorization: "Bearer stale-token" },
      });

      expect(response.status).toBe(403);
      expect(await response.json()).toEqual(blastaReply.body);
      expect(captured).toHaveLength(1);
    });

    it("updates the local message status from Blasta's DLR", async () => {
      blastaReply = {
        status: 201,
        body: { msg_id: "REAL-MSG-002", status_code: "201", description: "Message accepted" },
      };
      const sendRes = await client.v3.api.send_sms.$post({
        json: SEND,
        header: { Authorization: "Bearer token-abc" },
      });
      expect(sendRes.status).toBe(201);

      blastaReply = {
        status: 200,
        body: {
          msg_id: "REAL-MSG-002",
          submitted_at: "2026-09-24T21:00:00.000+03:00",
          status: "delivered",
          status_code: "200",
          description: "Delivered",
        },
      };
      const dlrRes = await client.v3.api.dlr.$post({
        json: { msgId: "REAL-MSG-002" },
        header: { Authorization: "Bearer token-abc" },
      });
      expect(dlrRes.status).toBe(200);

      const rows = await db.select().from(smsMessages).where(eq(smsMessages.msgId, "REAL-MSG-002"));
      expect(rows).toHaveLength(1);
      expect(rows[0].status).toBe("delivered");
      await db.delete(smsMessages).where(eq(smsMessages.msgId, "REAL-MSG-002"));
    });
  });
});

import * as HttpStatusCodes from "stoker/http-status-codes";

import type { AppRouteHandler } from "@/lib/types";

import db from "@/db";
import { authTokens, optIns, optOuts, smsMessages } from "@/db/schema";
import env from "@/env";

import type { GetDlrRoute, GetTokenRoute, ListOptOutsRoute, OptInRoute, OptOutRoute, SendSmsRoute } from "./sms.routes";

// Mock Blasta API responses for testing
const mockBlastaResponses = {
  sendSms: {
    success: { msg_id: "mock-msg-001", status_code: "201", description: "Message accepted" },
    failure: { msg_id: "", status_code: "400", description: "Invalid message format" },
  },
  getDlr: {
    success: { msg_id: "mock-msg-001", submitted_at: new Date().toISOString(), status: "delivered", status_code: "200", description: "Delivered" },
    failure: { msg_id: "nonexistent", status_code: "404", description: "Message not found" },
  },
  getToken: {
    success: { access_token: "mock-token-123", first_name: "Test", last_name: "User", username: "testuser", description: "Token generated", status_code: "201" },
    failure: { access_token: "", description: "Invalid credentials", status_code: "422" },
  },
  optOut: {
    success: { added: 1, already_listed: 0, removed: 0, not_listed: 0, category: "promotional", description: "Opted out", status_code: 200 },
    failure: { added: 0, already_listed: 0, removed: 0, not_listed: 0, category: "promotional", description: "Validation error", status_code: 422 },
  },
  optIn: {
    success: { added: 1, already_listed: 0, removed: 0, not_listed: 0, category: "promotional", description: "Opted in", status_code: 200 },
    failure: { added: 0, already_listed: 0, removed: 0, not_listed: 0, category: "promotional", description: "Validation error", status_code: 422 },
  },
  listOptOuts: {
    success: [
      { phone_number: "+1234567890", category: "promotional", reason: "User requested", source: "api", created_at: new Date().toISOString() },
    ],
    failure: [],
  },
};

function getAuthToken(c: { req: { header: (name: string) => string | undefined } }): string | undefined {
  return c.req.header("authToken") || c.req.header("Authorization")?.replace("Bearer ", "");
}

const endpointToMock = {
  "/send_sms/": "sendSms",
  "/dlr/": "getDlr",
  "/get_token/": "getToken",
  "/opt_out/": "optOut",
  "/opt_in/": "optIn",
  "/opt_outs/": "listOptOuts",
} as const;

async function callBlasta(endpoint: string, method: string, body: unknown, authToken?: string, useMock = true): Promise<Record<string, unknown>> {
  if (useMock) {
    const mockKey = endpointToMock[endpoint as keyof typeof endpointToMock];
    const mockResponse = mockKey ? mockBlastaResponses[mockKey] : undefined;
    if (mockResponse && mockResponse.success) {
      return mockResponse.success as Record<string, unknown>;
    }
    return (mockResponse?.failure || { msg_id: "", status_code: "500", description: "Mock error" }) as Record<string, unknown>;
  }

  const url = `${env.BLASTA_BASE_URL}${endpoint}`;
  const response = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(authToken ? { authToken } : {}),
    },
    ...(method !== "GET" ? { body: JSON.stringify(body) } : {}),
  });
  return response.json() as Promise<Record<string, unknown>>;
}

export const sendSms: AppRouteHandler<SendSmsRoute> = async (c) => {
  const data = c.req.valid("json");
  const authToken = getAuthToken(c);

  const result = await callBlasta("/send_sms/", "POST", data, authToken, true);

  await db.insert(smsMessages).values({
    msgId: String(result.msg_id ?? ""),
    phone: data.numbers,
    msg: data.msg,
    dlrUrl: data.dlr_url,
    category: data.category,
    status: result.status_code === "201" ? "sent" : "failed",
  });

  return c.json(result as { msg: string; status_code: string; description: string }, HttpStatusCodes.CREATED);
};

export const getDlr: AppRouteHandler<GetDlrRoute> = async (c) => {
  const body = c.req.valid("json") as { msgId: string };
  const authToken = getAuthToken(c);

  const result = await callBlasta("/dlr/", "POST", { msgId: body.msgId }, authToken, true);

  return c.json(result as { msg_id: string; submitted_at: string; status: string; status_code: string; description: string }, HttpStatusCodes.OK);
};

export const getToken: AppRouteHandler<GetTokenRoute> = async (c) => {
  const { username, password } = c.req.valid("json");

  const result = await callBlasta("/get_token/", "POST", { username, password }, undefined, true /* useMock */);

  if (result.access_token && result.status_code !== "422") {
    await db.insert(authTokens).values({
      username,
      accessToken: String(result.access_token),
      firstName: result.first_name as string | undefined,
      lastName: result.last_name as string | undefined,
    });
  }

  return c.json(result as { access_token: string; first_name: string; last_name: string; username: string; description: string; status_code: string }, HttpStatusCodes.CREATED);
};

export const optOut: AppRouteHandler<OptOutRoute> = async (c) => {
  const { numbers, category, reason } = c.req.valid("json");
  const authToken = getAuthToken(c);

  const result = await callBlasta("/opt_out/", "POST", { numbers, category, reason }, authToken, true);

  await db.insert(optOuts).values({
    phoneNumber: numbers,
    category,
    reason,
    source: "api",
  });

  return c.json(result as { added: number; already_listed: number; removed: number; not_listed: number; category: string; description: string; status_code: number }, HttpStatusCodes.OK);
};

export const optIn: AppRouteHandler<OptInRoute> = async (c) => {
  const { numbers, category, reason } = c.req.valid("json");
  const authToken = getAuthToken(c);

  const result = await callBlasta("/opt_in/", "POST", { numbers, category, reason }, authToken, true);

  await db.insert(optIns).values({
    phoneNumber: numbers,
    category,
    reason,
    source: "api",
  });

  return c.json(result as { added: number; already_listed: number; removed: number; not_listed: number; category: string; description: string; status_code: number }, HttpStatusCodes.OK);
};

export const listOptOuts: AppRouteHandler<ListOptOutsRoute> = async (c) => {
  const authToken = getAuthToken(c);

  const result = await callBlasta("/opt_outs/", "GET", undefined, authToken, true);

  return c.json(result as unknown as { phone_number: string; category: string; reason: string; source: string; created_at: string }[], HttpStatusCodes.OK);
};

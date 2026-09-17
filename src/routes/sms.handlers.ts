import type { Context } from "hono";

import type { AppBindings, AppRouteHandler } from "@/lib/types";

import db from "@/db";
import { authTokens, optIns, optOuts, smsMessages } from "@/db/schema";

import type { GetDlrRoute, GetTokenRoute, ListOptOutsRoute, OptInRoute, OptOutRoute, SendSmsRoute } from "./sms.routes";

import {
  mockGetDlr,
  mockGetToken,
  mockListOptOuts,
  mockOptIn,
  mockOptOut,
  mockSendSms,
  mockSetDlrStatus,
  resetMockState,
} from "./sms-mock";

function getAuthToken(c: { req: { header: (name: string) => string | undefined } }): string | undefined {
  return c.req.header("authToken") || c.req.header("Authorization")?.replace("Bearer ", "");
}

async function bestEffort(c: Context<AppBindings>, operation: () => Promise<unknown>): Promise<void> {
  try {
    await operation();
  }
  catch (error) {
    c.get("logger").error({ error }, "DB unavailable - request satisfied from mock state");
  }
}

export const sendSms: AppRouteHandler<SendSmsRoute> = async (c) => {
  const data = c.req.valid("json");
  const reply = mockSendSms(getAuthToken(c));

  if (reply.status === 401) {
    return c.json(reply.body, 401);
  }

  await bestEffort(c, async () => {
    await db.insert(smsMessages).values({
      msgId: reply.body.msg_id,
      phone: data.numbers,
      msg: data.msg,
      dlrUrl: data.dlr_url,
      category: data.category,
      status: "sent",
    });
  });

  return c.json(reply.body, 201);
};

export const getDlr: AppRouteHandler<GetDlrRoute> = async (c) => {
  const { msgId } = c.req.valid("json");
  const reply = mockGetDlr(msgId, getAuthToken(c));

  if (reply.status === 401) {
    return c.json(reply.body, 401);
  }
  if (reply.status === 404) {
    return c.json(reply.body, 404);
  }

  return c.json(reply.body, 200);
};

export const getToken: AppRouteHandler<GetTokenRoute> = async (c) => {
  const { username, password } = c.req.valid("json");
  const reply = mockGetToken(username, password);

  if (reply.status === 401) {
    return c.json(reply.body, 401);
  }

  await bestEffort(c, async () => {
    await db.insert(authTokens).values({
      username,
      accessToken: reply.body.access_token,
      firstName: reply.body.first_name,
      lastName: reply.body.last_name,
    });
  });

  return c.json(reply.body, 201);
};

export const optOut: AppRouteHandler<OptOutRoute> = async (c) => {
  const { numbers, category, reason } = c.req.valid("json");
  const reply = mockOptOut({ numbers, category, reason }, getAuthToken(c));

  if (reply.status === 401) {
    return c.json(reply.body, 401);
  }

  await bestEffort(c, async () => {
    await db.insert(optOuts).values({
      phoneNumber: numbers,
      category,
      reason,
      source: "api",
    });
  });

  return c.json(reply.body, 200);
};

export const optIn: AppRouteHandler<OptInRoute> = async (c) => {
  const { numbers, category, reason } = c.req.valid("json");
  const reply = mockOptIn({ numbers, category, reason }, getAuthToken(c));

  if (reply.status === 401) {
    return c.json(reply.body, 401);
  }

  await bestEffort(c, async () => {
    await db.insert(optIns).values({
      phoneNumber: numbers,
      category,
      reason,
      source: "api",
    });
  });

  return c.json(reply.body, 200);
};

export const listOptOuts: AppRouteHandler<ListOptOutsRoute> = async (c) => {
  const reply = mockListOptOuts(getAuthToken(c));

  if (reply.status === 401) {
    return c.json(reply.body, 401);
  }

  return c.json(reply.body, 200);
};

export function resetMock(c: Context<AppBindings>) {
  resetMockState();
  return c.json({ reset: true });
}

export function deliverDlr(c: Context<AppBindings>) {
  const { msgId } = c.req.param();
  const reply = mockSetDlrStatus(msgId, "delivered");

  if (reply.status === 404) {
    return c.json(reply.body, 404);
  }

  return c.json(reply.body, 200);
}

export function failDlr(c: Context<AppBindings>) {
  const { msgId } = c.req.param();
  const reply = mockSetDlrStatus(msgId, "failed");

  if (reply.status === 404) {
    return c.json(reply.body, 404);
  }

  return c.json(reply.body, 200);
}

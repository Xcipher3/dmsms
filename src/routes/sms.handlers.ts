import * as HttpStatusCodes from "stoker/http-status-codes";

import type { AppRouteHandler } from "@/lib/types";

import db from "@/db";
import { authTokens, optOuts, smsMessages } from "@/db/schema";
import env from "@/env";

import type { GetDlrRoute, GetTokenRoute, ListOptOutsRoute, OptInRoute, OptOutRoute, SendSmsRoute } from "./sms.routes";

const BASE_URL = env.BLASTA_BASE_URL;

function getAuthToken(c: { req: { header: (name: string) => string | undefined } }): string | undefined {
  return c.req.header("authToken") || c.req.header("Authorization")?.replace("Bearer ", "");
}

async function callBlasta(endpoint: string, method: string, body: unknown, authToken?: string) {
  const url = `${BASE_URL}${endpoint}`;
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

  const result = await callBlasta("/send_sms/", "POST", data, authToken);

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

  const result = await callBlasta("/dlr/", "POST", { msgId: body.msgId }, authToken);

  return c.json(result as { msg_id: string; submitted_at: string; status: string; status_code: string; description: string }, HttpStatusCodes.OK);
};

export const getToken: AppRouteHandler<GetTokenRoute> = async (c) => {
  const { username, password } = c.req.valid("json");

  const result = await callBlasta("/get_token/", "POST", { username, password });

  if (result.access_token) {
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

  const result = await callBlasta("/opt_out/", "POST", { numbers, category, reason }, authToken);

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

  const result = await callBlasta("/opt_in/", "POST", { numbers, category, reason }, authToken);

  await db.insert(optOuts).values({
    phoneNumber: numbers,
    category,
    reason,
    source: "api",
  });

  return c.json(result as { added: number; already_listed: number; removed: number; not_listed: number; category: string; description: string; status_code: number }, HttpStatusCodes.OK);
};

export const listOptOuts: AppRouteHandler<ListOptOutsRoute> = async (c) => {
  const authToken = getAuthToken(c);

  const result = await callBlasta("/opt_outs/", "GET", undefined, authToken);

  return c.json(result as unknown as { phone_number: string; category: string; reason: string; source: string; created_at: string }[], HttpStatusCodes.OK);
};

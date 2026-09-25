import type { Context } from "hono";

import { and, eq } from "drizzle-orm";

import type { BlastaReply } from "@/lib/blasta";
import type { AppBindings, AppRouteHandler } from "@/lib/types";

import db from "@/db";
import { authTokens, eatNow, idempotencyKeys, smsEvents, smsMessages, smsRecipients } from "@/db/schema";
import { isMockMode } from "@/env";
import { callBlasta } from "@/lib/blasta";
import { toEatIso } from "@/lib/eat-time";
import { hashToken } from "@/lib/hash";

import type { DlrBody, DlrStatus, NotFoundBody, SendOkBody, TokenErrorBody, TokenOkBody } from "./sms-mock";
import type { BlastaErrorBody, GetDlrRoute, GetTokenRoute, SendSmsAuthErrorBody, SendSmsRoute } from "./sms.routes";

import { DLR_DESCRIPTIONS, mockGetDlr, mockGetToken, mockSendSms } from "./sms-mock";

const SEND_SMS_ENDPOINT = "POST /v3/api/send_sms";

interface RequestBodyReader {
  req: {
    header: (name: string) => string | undefined;
    valid: (target: "json" | "form") => unknown;
  };
}

function getRequestBody<T>(c: RequestBodyReader): T {
  const contentType = c.req.header("content-type")?.toLowerCase() ?? "";
  const target = contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data")
    ? "form"
    : "json";
  return c.req.valid(target) as T;
}

async function bestEffort(c: Context<AppBindings>, operation: () => Promise<unknown>): Promise<void> {
  try {
    await operation();
  }
  catch (error) {
    c.get("logger").error({ error }, "DB unavailable - request satisfied from mock state");
  }
}

async function isValidToken(c: Context<AppBindings>): Promise<boolean> {
  if (isMockMode())
    return true;
  const token = c.get("authToken");
  if (!token)
    return false;
  const hashedToken = hashToken(token);
  const rows = await db.select().from(authTokens).where(eq(authTokens.accessToken, hashedToken)).limit(1);
  return rows.length > 0;
}

export const getToken: AppRouteHandler<GetTokenRoute> = async (c) => {
  const { username, password } = getRequestBody<{ username: string; password: string }>(c);

  if (!isMockMode()) {
    let gateway: BlastaReply;
    try {
      gateway = await callBlasta("/get_token/", { username, password });
    }
    catch (error) {
      c.get("logger").error({ error }, "Blasta gateway unreachable");
      return c.json({ access_token: "", description: "Blasta gateway unreachable", status_code: "502" }, 502);
    }

    const accessToken = gateway.body.access_token;
    if (typeof accessToken === "string" && accessToken.length > 0) {
      const firstName = typeof gateway.body.first_name === "string" ? gateway.body.first_name : null;
      const lastName = typeof gateway.body.last_name === "string" ? gateway.body.last_name : null;
      const hashedToken = hashToken(accessToken);
      await bestEffort(c, async () => {
        await db.insert(authTokens).values({
          username,
          accessToken: hashedToken,
          firstName,
          lastName,
        }).onConflictDoUpdate({
          target: authTokens.username,
          set: {
            accessToken: hashedToken,
            firstName,
            lastName,
          },
        });
      });
      return c.json(gateway.body as unknown as TokenOkBody, 201);
    }
    if (gateway.status === 400)
      return c.json(gateway.body as unknown as TokenErrorBody, 400);
    if (gateway.status === 401)
      return c.json(gateway.body as unknown as TokenErrorBody, 401);
    if (gateway.status === 403 || gateway.status === 404)
      return c.json(gateway.body as unknown as TokenErrorBody, gateway.status === 403 ? 400 : 404);

    c.get("logger").error({ status: gateway.status }, "unexpected Blasta gateway response");
    return c.json({ access_token: "", description: "Unexpected response from Blasta gateway", status_code: "502" }, 502);
  }

  const reply = mockGetToken(username, password);

  if (reply.status === 401) {
    return c.json(reply.body, 401);
  }

  await bestEffort(c, async () => {
    const hashedToken = hashToken(reply.body.access_token);
    await db.insert(authTokens).values({
      username,
      accessToken: hashedToken,
      firstName: reply.body.first_name,
      lastName: reply.body.last_name,
    }).onConflictDoUpdate({
      target: authTokens.username,
      set: {
        accessToken: hashedToken,
        firstName: reply.body.first_name,
        lastName: reply.body.last_name,
      },
    });
  });

  return c.json(reply.body, 201);
};

export const sendSms: AppRouteHandler<SendSmsRoute> = async (c) => {
  const data = getRequestBody<{
    msg: string;
    numbers: string;
    dlr_url: string;
    category: string;
  }>(c);
  const idempotencyKey = c.req.header("idempotency-key");

  if (idempotencyKey) {
    try {
      const rows = await db.select().from(idempotencyKeys).where(and(
        eq(idempotencyKeys.endpoint, SEND_SMS_ENDPOINT),
        eq(idempotencyKeys.idempotencyKey, idempotencyKey),
      )).limit(1);
      const hit = rows[0];
      if (hit && (!hit.expiresAt || hit.expiresAt.getTime() > Date.now())) {
        return c.json(hit.responseBody as unknown as SendOkBody, hit.statusCode as 201);
      }
    }
    catch (error) {
      c.get("logger").error({ error }, "DB unavailable - idempotency check skipped");
    }
  }

  if (!await isValidToken(c))
    return c.json({ status_code: 401, description: "Invalid auth token" }, 401);

  const phoneNumbers = [...new Set(
    data.numbers
      .split(",")
      .map(n => n.trim())
      .filter(Boolean),
  )];

  if (phoneNumbers.length === 0) {
    return c.json({ msg_id: "", status_code: "400", description: "No valid phone numbers provided" }, 400);
  }

  let reply: { status: number; body: SendOkBody };
  if (isMockMode()) {
    reply = { status: 201, body: mockSendSms().body };
  }
  else {
    let gateway: BlastaReply;
    try {
      gateway = await callBlasta("/send_sms/", data, c.get("authToken"));
    }
    catch (error) {
      c.get("logger").error({ error }, "Blasta gateway unreachable");
      return c.json({ msg_id: "", status_code: "502", description: "Blasta gateway unreachable" }, 502);
    }
    if (gateway.status === 400)
      return c.json(gateway.body as unknown as BlastaErrorBody, 400);
    if (gateway.status === 401)
      return c.json(gateway.body as unknown as SendSmsAuthErrorBody, 401);
    if (gateway.status === 403)
      return c.json({ status_code: 401, description: (gateway.body as unknown as { description?: string }).description ?? "Invalid auth token" }, 401);
    if (gateway.status !== 201) {
      c.get("logger").error({ status: gateway.status }, "unexpected Blasta gateway response");
      return c.json({ msg_id: "", status_code: "502", description: "Unexpected response from Blasta gateway" }, 502);
    }
    reply = { status: 201, body: gateway.body as unknown as SendOkBody };
  }

  const messageId = crypto.randomUUID();

  const recipientRows = phoneNumbers.map(phone => ({
    id: crypto.randomUUID(),
    messageId,
    phone,
  }));

  await bestEffort(c, async () => {
    if (recipientRows.length === 0) {
      return;
    }
    await db.batch([
      db.insert(smsMessages).values({
        id: messageId,
        msgId: reply.body.msg_id,
        msg: data.msg,
        dlrUrl: data.dlr_url,
        category: data.category,
        recipientCount: recipientRows.length,
        status: "pending",
      }),
      db.insert(smsRecipients).values(recipientRows),
      db.insert(smsEvents).values(recipientRows.map(r => ({
        id: crypto.randomUUID(),
        messageId,
        recipientId: r.id,
        eventType: "submitted" as const,
      }))),
      ...(idempotencyKey
        ? [db.insert(idempotencyKeys).values({
            idempotencyKey,
            endpoint: SEND_SMS_ENDPOINT,
            requestId: c.get("requestId"),
            statusCode: reply.status,
            msgId: reply.body.msg_id,
            responseBody: reply.body,
          }).onConflictDoUpdate({
            target: [idempotencyKeys.endpoint, idempotencyKeys.idempotencyKey],
            set: {
              requestId: c.get("requestId"),
              statusCode: reply.status,
              msgId: reply.body.msg_id,
              responseBody: reply.body,
              createdAt: new Date(),
              expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
            },
          })]
        : []),
    ]);
  });

  return c.json(reply.body, 201);
};

export const getDlr: AppRouteHandler<GetDlrRoute> = async (c) => {
  const { msgId: camelId, msg_id: snakeId } = getRequestBody<{
    msgId?: string;
    msg_id?: string;
  }>(c);
  const msgId = (camelId ?? snakeId)!;

  if (!isMockMode()) {
    if (!await isValidToken(c))
      return c.json({ status_code: 401, description: "Invalid auth token" }, 401);

    let gateway: BlastaReply;
    try {
      gateway = await callBlasta("/dlr/", { msgId }, c.get("authToken"));
    }
    catch (error) {
      c.get("logger").error({ error }, "Blasta gateway unreachable");
      return c.json({ msg_id: "", status_code: "502", description: "Blasta gateway unreachable" }, 502);
    }

    if (gateway.status === 200) {
      const rawStatus = gateway.body.status;
      const status: DlrStatus | undefined
        = rawStatus === "delivered" || rawStatus === "failed" || rawStatus === "pending" ? rawStatus : undefined;
      if (status) {
        await bestEffort(c, async () => {
          await db.update(smsMessages)
            .set({ status, updatedAt: eatNow() })
            .where(eq(smsMessages.msgId, msgId));
        });
      }
      return c.json(gateway.body as unknown as DlrBody, 200);
    }
    if (gateway.status === 400)
      return c.json(gateway.body as unknown as BlastaErrorBody, 400);
    if (gateway.status === 401)
      return c.json(gateway.body as unknown as BlastaErrorBody, 401);
    if (gateway.status === 403)
      return c.json(gateway.body as unknown as BlastaErrorBody, 403);
    if (gateway.status === 404)
      return c.json(gateway.body as unknown as NotFoundBody, 404);

    c.get("logger").error({ status: gateway.status }, "unexpected Blasta gateway response");
    return c.json({ msg_id: "", status_code: "502", description: "Unexpected response from Blasta gateway" }, 502);
  }

  let dbRow: typeof smsMessages.$inferSelect | undefined;
  try {
    const rows = await db.select()
      .from(smsMessages)
      .where(eq(smsMessages.msgId, msgId))
      .orderBy(smsMessages.id)
      .limit(1);
    dbRow = rows[0];
  }
  catch (error) {
    c.get("logger").error({ error }, "DB unavailable - DLR read from mock state");
  }

  if (dbRow) {
    const rawStatus = dbRow.status as unknown;
    const status: DlrStatus = rawStatus === "delivered" || rawStatus === "failed" ? rawStatus : "pending";
    return c.json({
      msg_id: dbRow.msgId,
      submitted_at: toEatIso(dbRow.submittedAt ?? new Date()),
      status,
      status_code: "200",
      description: DLR_DESCRIPTIONS[status],
    }, 200);
  }

  const reply = mockGetDlr(msgId);

  if (reply.status === 404) {
    return c.json(reply.body, 404);
  }

  return c.json(reply.body, 200);
};

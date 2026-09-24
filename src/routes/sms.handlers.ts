import type { Context } from "hono";

import { and, eq } from "drizzle-orm";

import type { AppBindings, AppRouteHandler } from "@/lib/types";

import db from "@/db";
import { idempotencyKeys, smsEvents, smsMessages, smsRecipients } from "@/db/schema";
import { toEatIso } from "@/lib/eat-time";

import type { DlrStatus, SendOkBody } from "./sms-mock";
import type { GetDlrRoute, SendSmsRoute } from "./sms.routes";

import { DLR_DESCRIPTIONS, mockGetDlr, mockSendSms } from "./sms-mock";

const SEND_SMS_ENDPOINT = "POST /v3/api/send_sms";

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
  const idempotencyKey = c.req.header("idempotency-key");

  if (idempotencyKey) {
    try {
      const rows = await db.select().from(idempotencyKeys).where(and(
        eq(idempotencyKeys.endpoint, SEND_SMS_ENDPOINT),
        eq(idempotencyKeys.idempotencyKey, idempotencyKey),
      )).limit(1);
      const hit = rows[0];
      if (hit && (!hit.expiresAt || hit.expiresAt.getTime() > Date.now())) {
        return c.json(hit.responseBody as SendOkBody, hit.statusCode as 201);
      }
    }
    catch (error) {
      c.get("logger").error({ error }, "DB unavailable - idempotency check skipped");
    }
  }

  const reply = mockSendSms();
  const messageId = crypto.randomUUID();

  const phoneNumbers = [...new Set(
    data.numbers
      .split(",")
      .map(n => n.trim())
      .filter(Boolean),
  )];

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
  const { msgId: camelId, msg_id: snakeId } = c.req.valid("json");
  const msgId = (camelId ?? snakeId)!;

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

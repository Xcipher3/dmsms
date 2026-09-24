import { sql } from "drizzle-orm";
import { bigserial, index, integer, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

import { toZodV4SchemaTyped } from "@/lib/zod-utils";

export const eatNow = () => sql`(now() AT TIME ZONE 'Africa/Nairobi')`;

export const smsDeliveryStatusEnum = pgEnum("sms_delivery_status", ["pending", "delivered", "failed"]);
export const smsEventTypeEnum = pgEnum("sms_event_type", ["submitted", "delivered", "failed"]);

export const apiRequests = pgTable("api_requests", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  requestId: text("request_id").notNull(),
  method: text().notNull(),
  path: text().notNull(),
  query: text(),
  statusCode: integer("status_code").notNull(),
  durationMs: integer("duration_ms").notNull(),
  ip: text(),
  userAgent: text("user_agent"),
  headers: jsonb("headers"),
  error: text(),
  requestBody: jsonb("request_body"),
  responseBody: jsonb("response_body"),
  createdAt: timestamp("created_at").default(eatNow()),
}, t => [
  uniqueIndex("api_requests_request_id_idx").on(t.requestId),
  index("api_requests_created_at_idx").on(t.createdAt),
  index("api_requests_status_code_idx").on(t.statusCode),
]);

export const smsMessages = pgTable("sms_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  msgId: text("msg_id").notNull(),
  msg: text().notNull(),
  dlrUrl: text("dlr_url").notNull(),
  category: text().notNull(),
  recipientCount: integer("recipient_count").notNull(),
  status: smsDeliveryStatusEnum("status").notNull().default("pending"),
  submittedAt: timestamp("submitted_at").default(eatNow()),
  createdAt: timestamp("created_at").default(eatNow()),
  updatedAt: timestamp("updated_at").default(eatNow()),
}, t => [
  uniqueIndex("sms_messages_msg_id_idx").on(t.msgId),
]);

export const smsRecipients = pgTable("sms_recipients", {
  id: uuid("id").primaryKey().defaultRandom(),
  messageId: uuid("message_id").notNull().references(() => smsMessages.id, { onDelete: "cascade" }),
  phone: text().notNull(),
  status: smsDeliveryStatusEnum("status").notNull().default("pending"),
  createdAt: timestamp("created_at").default(eatNow()),
  updatedAt: timestamp("updated_at").default(eatNow()),
}, t => [
  uniqueIndex("sms_recipients_message_phone_idx").on(t.messageId, t.phone),
  index("sms_recipients_status_idx").on(t.status),
]);

export const smsEvents = pgTable("sms_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  messageId: uuid("message_id").notNull().references(() => smsMessages.id, { onDelete: "cascade" }),
  recipientId: uuid("recipient_id").notNull().references(() => smsRecipients.id, { onDelete: "cascade" }),
  eventType: smsEventTypeEnum("event_type").notNull(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").default(eatNow()),
}, t => [
  index("sms_events_message_id_idx").on(t.messageId),
  index("sms_events_recipient_id_idx").on(t.recipientId),
  index("sms_events_created_at_idx").on(t.createdAt),
]);

export const idempotencyKeys = pgTable("idempotency_keys", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  idempotencyKey: text("idempotency_key").notNull(),
  endpoint: text().notNull(),
  requestId: text("request_id"),
  statusCode: integer("status_code").notNull(),
  msgId: text("msg_id"),
  responseBody: jsonb("response_body").notNull(),
  createdAt: timestamp("created_at").default(eatNow()),
  expiresAt: timestamp("expires_at", { withTimezone: true }).default(sql`now() + interval '24 hours'`),
}, t => [
  uniqueIndex("idempotency_keys_endpoint_key_idx").on(t.endpoint, t.idempotencyKey),
]);

export const selectSmsMessagesSchema = toZodV4SchemaTyped(createSelectSchema(smsMessages));

export const insertSmsMessagesSchema = toZodV4SchemaTyped(createInsertSchema(
  smsMessages,
  {
    msg: field => field.min(1),
    dlrUrl: field => field.min(1),
    category: field => field.min(1),
    recipientCount: field => field.int().positive(),
  },
).omit({
  id: true,
  msgId: true,
  submittedAt: true,
  createdAt: true,
  updatedAt: true,
}));

// @ts-expect-error partial exists on zod v4 type
export const patchSmsMessagesSchema = insertSmsMessagesSchema.partial();

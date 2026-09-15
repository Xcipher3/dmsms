import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

import { toZodV4SchemaTyped } from "@/lib/zod-utils";

export const smsMessages = pgTable("sms_messages", {
  id: serial("id").primaryKey(),
  msgId: text("msg_id").notNull(),
  phone: text().notNull(),
  msg: text().notNull(),
  dlrUrl: text("dlr_url").notNull(),
  category: text().notNull(),
  status: text().default("pending"),
  sentAt: timestamp("sent_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const authTokens = pgTable("auth_tokens", {
  id: serial("id").primaryKey(),
  username: text().notNull().unique(),
  accessToken: text("access_token").notNull(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const optOuts = pgTable("opt_outs", {
  id: serial("id").primaryKey(),
  phoneNumber: text("phone_number").notNull(),
  category: text().notNull(),
  reason: text().notNull(),
  source: text().notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const selectSmsMessagesSchema = toZodV4SchemaTyped(createSelectSchema(smsMessages));

export const insertSmsMessagesSchema = toZodV4SchemaTyped(createInsertSchema(
  smsMessages,
  {
    msg: field => field.min(1),
    phone: field => field.min(1),
    dlrUrl: field => field.min(1),
    category: field => field.min(1),
  },
).omit({
  id: true,
  msgId: true,
  sentAt: true,
  createdAt: true,
  updatedAt: true,
}));

// @ts-expect-error partial exists on zod v4 type
export const patchSmsMessagesSchema = insertSmsMessagesSchema.partial();

export const selectAuthTokensSchema = toZodV4SchemaTyped(createSelectSchema(authTokens));

export const insertAuthTokensSchema = toZodV4SchemaTyped(createInsertSchema(
  authTokens,
  {
    username: field => field.min(1),
    accessToken: field => field.min(1),
  },
).omit({
  id: true,
  createdAt: true,
}));

// @ts-expect-error partial exists on zod v4 type
export const patchAuthTokensSchema = insertAuthTokensSchema.partial();

export const selectOptOutsSchema = toZodV4SchemaTyped(createSelectSchema(optOuts));

export const insertOptOutsSchema = toZodV4SchemaTyped(createInsertSchema(
  optOuts,
  {
    phoneNumber: field => field.min(1),
    category: field => field.min(1),
    reason: field => field.min(1),
    source: field => field.min(1),
  },
).omit({
  id: true,
  createdAt: true,
}));

// @ts-expect-error partial exists on zod v4 type
export const patchOptOutsSchema = insertOptOutsSchema.partial();

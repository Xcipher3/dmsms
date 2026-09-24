import { eq, inArray } from "drizzle-orm";
import * as HttpStatusCodes from "stoker/http-status-codes";

import db from "@/db";
import { eatNow, smsEvents, smsMessages, smsRecipients } from "@/db/schema";
import env from "@/env";
import { toEatIso } from "@/lib/eat-time";

export type DlrStatus = "pending" | "delivered" | "failed";

export interface TokenOkBody {
  access_token: string;
  first_name: string;
  last_name: string;
  username: string;
  description: string;
  status_code: string;
}

export interface TokenErrorBody {
  access_token: string;
  description: string;
  status_code: string;
}

export interface SendOkBody {
  msg_id: string;
  status_code: string;
  description: string;
}

export interface DlrBody {
  msg_id: string;
  submitted_at: string;
  status: DlrStatus;
  status_code: string;
  description: string;
}

export interface NotFoundBody {
  message: string;
}

export type GetTokenReply
  = | { status: 201; body: TokenOkBody }
    | { status: 401; body: TokenErrorBody };

export type SendSmsReply
  = | { status: 201; body: SendOkBody };

export type GetDlrReply
  = | { status: 200; body: DlrBody }
    | { status: 404; body: NotFoundBody };

export type SetDlrReply
  = | { status: 200; body: { msgId: string; status: Extract<DlrStatus, "delivered" | "failed"> } }
    | { status: 404; body: NotFoundBody };

interface MessageRecord {
  submittedAt: string;
  status: DlrStatus;
}

export const DLR_DESCRIPTIONS: Record<DlrStatus, string> = {
  pending: "Delivery pending",
  delivered: "Delivered",
  failed: "Delivery failed",
};

class SmsMockState {
  readonly messages = new Map<string, MessageRecord>();
  readonly tokens = new Set<string>();

  reset(): void {
    this.messages.clear();
    this.tokens.clear();
  }

  nextMsgId(): string {
    const bytes = crypto.getRandomValues(new Uint8Array(4));
    return [...bytes].map(b => b.toString(16).padStart(2, "0")).join("").toUpperCase();
  }

  issueToken(): string {
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    const bytes = crypto.getRandomValues(new Uint8Array(7));
    let token = "";
    for (let i = 0; i < bytes.length; i++) {
      token += alphabet[bytes[i] % alphabet.length];
    }
    this.tokens.add(token);
    return token;
  }

  setDlrStatus(msgId: string, status: DlrStatus): boolean {
    const record = this.messages.get(msgId);
    if (!record) {
      return false;
    }
    record.status = status;
    return true;
  }
}

const state = new SmsMockState();

export function resetMockState(): void {
  state.reset();
}

export function mockGetToken(username: string, password: string): GetTokenReply {
  if (username === env.BLASTA_USERNAME && password === env.BLASTA_PASSWORD) {
    return {
      status: HttpStatusCodes.CREATED,
      body: {
        access_token: state.issueToken(),
        first_name: "Test",
        last_name: "User",
        username,
        description: "Token generated",
        status_code: "201",
      },
    };
  }
  return {
    status: HttpStatusCodes.UNAUTHORIZED,
    body: { access_token: "", description: "Invalid credentials", status_code: "401" },
  };
}

export function mockSendSms(): SendSmsReply {
  const msgId = state.nextMsgId();
  state.messages.set(msgId, {
    submittedAt: toEatIso(),
    status: "pending",
  });
  return {
    status: HttpStatusCodes.CREATED,
    body: { msg_id: msgId, status_code: "201", description: "Message accepted" },
  };
}

export function mockGetDlr(msgId: string): GetDlrReply {
  const record = state.messages.get(msgId);
  if (!record) {
    return {
      status: HttpStatusCodes.NOT_FOUND,
      body: { message: "Not Found" },
    };
  }
  return {
    status: HttpStatusCodes.OK,
    body: {
      msg_id: msgId,
      submitted_at: record.submittedAt,
      status: record.status,
      status_code: "200",
      description: DLR_DESCRIPTIONS[record.status],
    },
  };
}

export async function mockSetDlrStatus(msgId: string, status: "delivered" | "failed"): Promise<SetDlrReply> {
  const applied = state.setDlrStatus(msgId, status);
  if (!applied) {
    return {
      status: HttpStatusCodes.NOT_FOUND,
      body: { message: "Not Found" },
    };
  }
  try {
    const messages = await db.select({ id: smsMessages.id })
      .from(smsMessages)
      .where(eq(smsMessages.msgId, msgId))
      .limit(1);
    const message = messages[0];
    if (!message) {
      return { status: HttpStatusCodes.OK, body: { msgId, status } };
    }

    const recipients = await db.select({ id: smsRecipients.id })
      .from(smsRecipients)
      .where(eq(smsRecipients.messageId, message.id));

    await db.batch([
      db.update(smsMessages)
        .set({ status, updatedAt: eatNow() })
        .where(eq(smsMessages.id, message.id)),
      ...(recipients.length > 0
        ? [
            db.update(smsRecipients)
              .set({ status, updatedAt: eatNow() })
              .where(inArray(smsRecipients.id, recipients.map(r => r.id))),
            db.insert(smsEvents).values(recipients.map(r => ({
              id: crypto.randomUUID(),
              messageId: message.id,
              recipientId: r.id,
              eventType: status,
            }))),
          ]
        : []),
    ]);
  }
  catch (error) {
    console.error("[sms-mock] DB unavailable - DLR status kept in mock state", error);
  }
  return { status: HttpStatusCodes.OK, body: { msgId, status } };
}

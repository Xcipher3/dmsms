import * as HttpStatusCodes from "stoker/http-status-codes";

import env from "@/env";

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

export interface SendErrorBody {
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

export interface OptBody {
  added: number;
  already_listed: number;
  removed: number;
  not_listed: number;
  category: string;
  description: string;
  status_code: number;
}

export interface OptOutBody {
  phone_number: string;
  category: string;
  reason: string;
  source: string;
  created_at: string;
}

export interface NotFoundBody {
  message: string;
}

export type GetTokenReply
  = | { status: 201; body: TokenOkBody }
    | { status: 401; body: TokenErrorBody };

export type SendSmsReply
  = | { status: 201; body: SendOkBody }
    | { status: 401; body: SendErrorBody };

export type GetDlrReply
  = | { status: 200; body: DlrBody }
    | { status: 404; body: NotFoundBody }
    | { status: 401; body: SendErrorBody };

export type OptReply
  = | { status: 200; body: OptBody }
    | { status: 401; body: SendErrorBody };

export type OptOutsReply
  = | { status: 200; body: OptOutBody[] }
    | { status: 401; body: SendErrorBody };

export type SetDlrReply
  = | { status: 200; body: { msgId: string; status: Extract<DlrStatus, "delivered" | "failed"> } }
    | { status: 404; body: NotFoundBody };

interface MessageRecord {
  submittedAt: string;
  status: DlrStatus;
}

interface OptRecord {
  phoneNumber: string;
  category: string;
  reason: string;
  createdAt: string;
}

const DLR_DESCRIPTIONS: Record<DlrStatus, string> = {
  pending: "Delivery pending",
  delivered: "Delivered",
  failed: "Delivery failed",
};

class SmsMockState {
  readonly messages = new Map<string, MessageRecord>();
  readonly optOuts = new Map<string, OptRecord>();
  readonly optIns = new Map<string, OptRecord>();
  readonly tokens = new Set<string>();

  private msgCounter = 0;

  reset(): void {
    this.messages.clear();
    this.optOuts.clear();
    this.optIns.clear();
    this.tokens.clear();
    this.msgCounter = 0;
  }

  nextMsgId(): string {
    this.msgCounter += 1;
    return `mock-msg-${String(this.msgCounter).padStart(3, "0")}`;
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

  hasToken(token: string | undefined): boolean {
    return token !== undefined && this.tokens.has(token);
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

function unauthorizedReply(): { status: 401; body: SendErrorBody } {
  return {
    status: 401,
    body: { status_code: "401", description: "Invalid auth token" },
  };
}

function guarded<Reply extends { status: number }>(
  reply: () => Reply,
  authToken: string | undefined,
): Reply | { status: 401; body: SendErrorBody } {
  if (!state.hasToken(authToken)) {
    return unauthorizedReply();
  }
  return reply();
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

export function mockSendSms(authToken: string | undefined): SendSmsReply {
  return guarded(() => {
    const msgId = state.nextMsgId();
    state.messages.set(msgId, {
      submittedAt: new Date().toISOString(),
      status: "pending",
    });
    return {
      status: HttpStatusCodes.CREATED,
      body: { msg_id: msgId, status_code: "201", description: "Message accepted" },
    };
  }, authToken);
}

export function mockGetDlr(msgId: string, authToken: string | undefined): GetDlrReply {
  return guarded(() => {
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
  }, authToken);
}

export function mockSetDlrStatus(msgId: string, status: "delivered" | "failed"): SetDlrReply {
  const applied = state.setDlrStatus(msgId, status);
  if (!applied) {
    return {
      status: HttpStatusCodes.NOT_FOUND,
      body: { message: "Not Found" },
    };
  }
  return { status: HttpStatusCodes.OK, body: { msgId, status } };
}

function mockOpt(
  collection: Map<string, OptRecord>,
  action: "out" | "in",
  body: { numbers: string; category: string; reason: string },
  authToken: string | undefined,
): OptReply {
  return guarded(() => {
    const key = `${body.numbers}|${body.category}`;
    if (collection.has(key)) {
      return {
        status: HttpStatusCodes.OK,
        body: {
          added: 0,
          already_listed: 1,
          removed: 0,
          not_listed: 0,
          category: body.category,
          description: `Already opted ${action}`,
          status_code: 200,
        },
      };
    }
    collection.set(key, {
      phoneNumber: body.numbers,
      category: body.category,
      reason: body.reason,
      createdAt: new Date().toISOString(),
    });
    return {
      status: HttpStatusCodes.OK,
      body: {
        added: 1,
        already_listed: 0,
        removed: 0,
        not_listed: 0,
        category: body.category,
        description: `Opted ${action}`,
        status_code: 200,
      },
    };
  }, authToken);
}

export function mockOptOut(
  body: { numbers: string; category: string; reason: string },
  authToken: string | undefined,
): OptReply {
  return mockOpt(state.optOuts, "out", body, authToken);
}

export function mockOptIn(
  body: { numbers: string; category: string; reason: string },
  authToken: string | undefined,
): OptReply {
  return mockOpt(state.optIns, "in", body, authToken);
}

export function mockListOptOuts(authToken: string | undefined): OptOutsReply {
  return guarded(() => ({
    status: HttpStatusCodes.OK,
    body: [...state.optOuts.values()].map(record => ({
      phone_number: record.phoneNumber,
      category: record.category,
      reason: record.reason,
      source: "api",
      created_at: record.createdAt,
    })),
  }), authToken);
}

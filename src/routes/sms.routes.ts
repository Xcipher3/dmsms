import { createRoute, z } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";

import { notFoundSchema } from "@/lib/constants";

const tags = ["Blasta SMS"];

const exceptionSchema = z.object({
  status_code: z.union([z.string(), z.number()]),
  description: z.string(),
});

function multiContentBody<T extends z.ZodTypeAny>(schema: T, description: string) {
  return {
    required: false,
    content: {
      "application/json": { schema },
      "application/x-www-form-urlencoded": { schema },
      "multipart/form-data": { schema },
    },
    description,
  };
}

export interface BlastaErrorBody {
  msg_id: string;
  status_code: string | number;
  description: string;
}

export interface SendSmsAuthErrorBody {
  status_code: number;
  description: string;
}

const sendSmsSchema = z.object({
  msg: z.string().min(1),
  numbers: z.string().min(1),
  dlr_url: z.string().min(1),
  category: z.string().min(1),
});

export const getToken = createRoute({
  operationId: "api_get_token_create",
  path: "/v3/api/get_token",
  method: "post",
  tags,
  request: {
    body: multiContentBody(
      z.object({
        username: z.string().min(1),
        password: z.string().min(1),
      }),
      "Credentials for token",
    ),
  },
  responses: {
    [HttpStatusCodes.CREATED]: jsonContent(
      z.object({
        access_token: z.string(),
        first_name: z.string(),
        last_name: z.string(),
        username: z.string(),
        description: z.string(),
        status_code: z.string(),
      }),
      "Token generated",
    ),
    [HttpStatusCodes.BAD_REQUEST]: jsonContent(
      exceptionSchema,
      "Blasta gateway error (forwarded as-is)",
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      exceptionSchema,
      "Invalid credentials",
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      exceptionSchema,
      "Account not found",
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      exceptionSchema,
      "Blasta gateway unreachable",
    ),
    [HttpStatusCodes.BAD_GATEWAY]: jsonContent(
      exceptionSchema,
      "Blasta gateway unreachable",
    ),
  },
});

export const sendSms = createRoute({
  operationId: "api_send_sms_create",
  path: "/v3/api/send_sms",
  method: "post",
  tags,
  request: {
    headers: z.object({
      authToken: z.string().optional().describe("Authorization token from get_token"),
    }),
    body: multiContentBody(
      sendSmsSchema,
      "The SMS to send",
    ),
  },
  responses: {
    [HttpStatusCodes.CREATED]: jsonContent(
      z.object({
        msg_id: z.string(),
        status_code: z.string(),
        description: z.string(),
      }),
      "The sent SMS",
    ),
    [HttpStatusCodes.BAD_REQUEST]: jsonContent(
      exceptionSchema,
      "The validation error(s)",
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      exceptionSchema,
      "Invalid auth token",
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      exceptionSchema,
      "Internal server error",
    ),
    [HttpStatusCodes.BAD_GATEWAY]: jsonContent(
      exceptionSchema,
      "Blasta gateway unreachable",
    ),
  },
});

export type SendSmsSchemaType = z.infer<typeof sendSmsSchema>;

const dlrSchema = z.object({
  msgId: z.string().min(1).optional(),
  msg_id: z.string().min(1).optional(),
}).refine(data => data.msgId ?? data.msg_id, {
  message: "Provide a message ID using 'msgId' or 'msg_id'",
  path: ["msgId"],
});

export const getDlr = createRoute({
  operationId: "api_dlr_create",
  path: "/v3/api/dlr",
  method: "post",
  tags,
  request: {
    headers: z.object({
      authToken: z.string().optional().describe("Authorization token from get_token"),
    }),
    body: multiContentBody(
      dlrSchema,
      "The message ID to check",
    ),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      z.object({
        msg_id: z.string(),
        submitted_at: z.string(),
        status: z.string(),
        status_code: z.string(),
        description: z.string(),
      }),
      "Delivery status",
    ),
    [HttpStatusCodes.BAD_REQUEST]: jsonContent(
      exceptionSchema,
      "The validation error(s)",
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      notFoundSchema,
      "Message not found",
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      exceptionSchema,
      "Invalid auth token",
    ),
    [HttpStatusCodes.FORBIDDEN]: jsonContent(
      exceptionSchema,
      "Blasta gateway error (forwarded as-is)",
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      exceptionSchema,
      "Internal server error",
    ),
    [HttpStatusCodes.BAD_GATEWAY]: jsonContent(
      exceptionSchema,
      "Blasta gateway unreachable",
    ),
  },
});

export type GetTokenRoute = typeof getToken;
export type SendSmsRoute = typeof sendSms;
export type GetDlrRoute = typeof getDlr;

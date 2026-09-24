import { createRoute, z } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent, jsonContentRequired } from "stoker/openapi/helpers";
import { createErrorSchema } from "stoker/openapi/schemas";

import { notFoundSchema } from "@/lib/constants";

const tags = ["Blasta SMS"];

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
    body: jsonContentRequired(
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
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      z.object({
        access_token: z.string(),
        description: z.string(),
        status_code: z.string(),
      }),
      "Invalid credentials",
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      createErrorSchema(z.object({
        username: z.string(),
        password: z.string(),
      })),
      "The validation error(s)",
    ),
  },
});

export const sendSms = createRoute({
  operationId: "api_send_sms_create",
  path: "/v3/api/send_sms",
  method: "post",
  tags,
  request: {
    body: jsonContentRequired(
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
      z.object({
        msg_id: z.string(),
        status_code: z.string(),
        description: z.string(),
      }),
      "The validation error(s)",
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
    body: jsonContentRequired(
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
      z.object({
        msg_id: z.string(),
        status_code: z.string(),
        description: z.string(),
      }),
      "The validation error(s)",
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      notFoundSchema,
      "Message not found",
    ),
  },
});

export type GetTokenRoute = typeof getToken;
export type SendSmsRoute = typeof sendSms;
export type GetDlrRoute = typeof getDlr;

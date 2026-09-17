import { createRoute, z } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent, jsonContentRequired } from "stoker/openapi/helpers";
import { createErrorSchema } from "stoker/openapi/schemas";

import { notFoundSchema } from "@/lib/constants";

const tags = ["Blasta SMS"];

const unauthorizedSchema = z.object({
  status_code: z.string(),
  description: z.string(),
});

const sendSmsSchema = z.object({
  msg: z.string().min(1),
  numbers: z.string().min(1),
  dlr_url: z.string().min(1),
  category: z.string().min(1),
});

export const sendSms = createRoute({
  operationId: "api_send_sms_create",
  path: "/v3/v3/api/send_sms",
  method: "post",
  tags,
  request: {
    headers: z.object({
      authToken: z.string().optional(),
    }),
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
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      unauthorizedSchema,
      "Invalid or missing auth token",
    ),
  },
});

export type SendSmsSchemaType = z.infer<typeof sendSmsSchema>;

export const getDlr = createRoute({
  operationId: "api_dlr_create",
  path: "/v3/v3/api/dlr",
  method: "post",
  tags,
  request: {
    headers: z.object({
      authToken: z.string().optional(),
    }),
    body: jsonContentRequired(
      z.object({
        msgId: z.string().min(1),
      }),
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
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      notFoundSchema,
      "Message not found",
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      unauthorizedSchema,
      "Invalid or missing auth token",
    ),
  },
});

export const getToken = createRoute({
  operationId: "api_get_token_create",
  path: "/v3/v3/api/get_token",
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

export const optOut = createRoute({
  operationId: "api_opt_out_create",
  path: "/v3/v3/api/opt_out",
  method: "post",
  tags,
  request: {
    headers: z.object({
      authToken: z.string().optional(),
    }),
    body: jsonContentRequired(
      z.object({
        numbers: z.string().min(1),
        category: z.string().min(1),
        reason: z.string().min(1),
      }),
      "Opt out request",
    ),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      z.object({
        added: z.number(),
        already_listed: z.number(),
        removed: z.number(),
        not_listed: z.number(),
        category: z.string(),
        description: z.string(),
        status_code: z.number(),
      }),
      "Opted out",
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      unauthorizedSchema,
      "Invalid or missing auth token",
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      createErrorSchema(z.object({
        numbers: z.string(),
        category: z.string(),
        reason: z.string(),
      })),
      "The validation error(s)",
    ),
  },
});

export const optIn = createRoute({
  operationId: "api_opt_in_create",
  path: "/v3/v3/api/opt_in",
  method: "post",
  tags,
  request: {
    headers: z.object({
      authToken: z.string().optional(),
    }),
    body: jsonContentRequired(
      z.object({
        numbers: z.string().min(1),
        category: z.string().min(1),
        reason: z.string().min(1),
      }),
      "Opt in request",
    ),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      z.object({
        added: z.number(),
        already_listed: z.number(),
        removed: z.number(),
        not_listed: z.number(),
        category: z.string(),
        description: z.string(),
        status_code: z.number(),
      }),
      "Opted in",
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      unauthorizedSchema,
      "Invalid or missing auth token",
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      createErrorSchema(z.object({
        numbers: z.string(),
        category: z.string(),
        reason: z.string(),
      })),
      "The validation error(s)",
    ),
  },
});

export const listOptOuts = createRoute({
  operationId: "api_opt_outs_list",
  path: "/v3/v3/api/opt_outs",
  method: "get",
  tags,
  request: {
    headers: z.object({
      authToken: z.string().optional(),
    }),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      z.array(
        z.object({
          phone_number: z.string(),
          category: z.string(),
          reason: z.string(),
          source: z.string(),
          created_at: z.string(),
        }),
      ),
      "List of opt-outs",
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      unauthorizedSchema,
      "Invalid or missing auth token",
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      createErrorSchema(z.object({})),
      "The validation error(s)",
    ),
  },
});

export type SendSmsRoute = typeof sendSms;
export type GetDlrRoute = typeof getDlr;
export type GetTokenRoute = typeof getToken;
export type OptOutRoute = typeof optOut;
export type OptInRoute = typeof optIn;
export type ListOptOutsRoute = typeof listOptOuts;

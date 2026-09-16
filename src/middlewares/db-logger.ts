import type { MiddlewareHandler } from "hono";

import type { AppBindings } from "@/lib/types";

import db from "@/db";
import { requestLogs } from "@/db/schema";

function parseJson(text: string): unknown {
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text);
  }
  catch {
    return null;
  }
}

export function dbLogger(): MiddlewareHandler<AppBindings> {
  return async (c, next) => {
    const startedAt = performance.now();
    const requestBody = parseJson(await c.req.raw.clone().text());
    await next();
    const durationMs = Math.round(performance.now() - startedAt);
    const responseBody = parseJson(await c.res.clone().text());

    db.insert(requestLogs).values({
      requestId: c.get("requestId"),
      method: c.req.method,
      path: c.req.path,
      statusCode: c.res.status,
      durationMs,
      ip: c.req.header("x-forwarded-for") ?? c.req.header("x-real-ip"),
      userAgent: c.req.header("user-agent"),
      error: c.error?.message,
      requestBody,
      responseBody,
    }).catch((err: unknown) => {
      c.get("logger").error({ err }, "failed to persist request log");
    });
  };
}

import type { MiddlewareHandler } from "hono";

import path from "node:path";
import pino from "pino";

import type { AppBindings } from "@/lib/types";

import db from "@/db";
import { apiRequests } from "@/db/schema";
import env from "@/env";
import { toEatIso } from "@/lib/eat-time";

const fileLogger = pino(
  {
    level: env.LOG_LEVEL || "info",
    timestamp: () => `,"time":"${toEatIso()}"`,
  },
  env.LOG_LEVEL === "silent"
    ? undefined
    : pino.transport({
        targets: [
          {
            target: "pino-roll",
            options: {
              file: path.join("logs", "requests"),
              frequency: "daily",
              mkdir: true,
            },
          },
        ],
      }),
);

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

const REDACTED_HEADERS = new Set(["authorization", "cookie", "set-cookie", "x-api-key"]);

function safeHeaders(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    out[lower] = REDACTED_HEADERS.has(lower) ? "[REDACTED]" : value;
  });
  return out;
}

export function dbLogger(): MiddlewareHandler<AppBindings> {
  return async (c, next) => {
    const startedAt = performance.now();
    const requestBody = parseJson(await c.req.raw.clone().text());
    await next();
    const durationMs = Math.round(performance.now() - startedAt);
    const responseBody = parseJson(await c.res.clone().text());
    const query = new URL(c.req.url).searchParams.toString();

    const record = {
      requestId: c.get("requestId"),
      method: c.req.method,
      path: c.req.path,
      query: query || null,
      statusCode: c.res.status,
      durationMs,
      ip: c.req.header("x-forwarded-for") ?? c.req.header("x-real-ip"),
      userAgent: c.req.header("user-agent"),
      headers: safeHeaders(c.req.raw.headers),
      error: c.error?.message,
      requestBody,
      responseBody,
    };

    fileLogger.info(record);

    db.insert(apiRequests).values(record).catch((err: unknown) => {
      c.get("logger").error({ err }, "failed to persist request log");
    });
  };
}

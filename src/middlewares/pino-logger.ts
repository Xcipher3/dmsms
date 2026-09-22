import { pinoLogger as logger } from "hono-pino";
import pino from "pino";
import pretty from "pino-pretty";

import env from "@/env";
import { toEatIso } from "@/lib/eat-time";

export function pinoLogger() {
  return logger({
    pino: pino({
      level: env.LOG_LEVEL || "info",
      timestamp: () => `,"time":"${toEatIso()}"`,
    }, env.NODE_ENV === "production"
      ? undefined
      : pretty({
          singleLine: true,
          translateTime: false,
          ignore: "pid,hostname",
        })),
    http: {
      onReqBindings: c => ({
        method: c.req.method,
        path: c.req.path,
      }),
      onResBindings: c => ({
        status: c.res.status,
      }),
    },
  });
}
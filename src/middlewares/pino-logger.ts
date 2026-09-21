import { pinoLogger as logger } from "hono-pino";
import pino from "pino";
import pretty from "pino-pretty";

import env from "@/env";

export function pinoLogger() {
  return logger({
    pino: pino({
      level: env.LOG_LEVEL || "info",
    }, env.NODE_ENV === "production"
      ? undefined
      : pretty({
          singleLine: true,
          translateTime: "HH:MM:ss",
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

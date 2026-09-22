import { OpenAPIHono } from "@hono/zod-openapi";
import type { Hook } from "@hono/zod-openapi";
import type { Hono, Schema } from "hono";
import { requestId } from "hono/request-id";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { notFound, onError, serveEmojiFavicon } from "stoker/middlewares";

import { dbLogger } from "@/middlewares/db-logger";
import { pinoLogger } from "@/middlewares/pino-logger";

import type { AppBindings } from "./types";

const validationHook: Hook<any, any, any, any> = (result, c) => {
  if (!result.success) {
    return c.json(
      {
        success: result.success,
        error: {
          name: result.error.name,
          issues: result.error.issues,
        },
      },
      HttpStatusCodes.BAD_REQUEST,
    );
  }
};

export function createRouter() {
  return new OpenAPIHono<AppBindings>({
    strict: false,
    defaultHook: validationHook,
  });
}

export default function createApp() {
  const app = createRouter();
  app.use(requestId())
    .use(serveEmojiFavicon("📝"))
    .use(pinoLogger())
    .use(dbLogger());

  app.notFound(notFound);
  app.onError(onError);
  return app;
}

export function createTestApp<S extends Schema>(router: Hono<AppBindings, S, "/">) {
  return createApp().route("/", router);
}

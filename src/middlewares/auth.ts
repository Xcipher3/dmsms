import type { MiddlewareHandler } from "hono";
import type { AppBindings } from "@/lib/types";

import { isMockMode } from "@/env";

export function authMiddleware(): MiddlewareHandler<AppBindings> {
  return async (c, next) => {
    if (isMockMode()) {
      await next();
      return;
    }

    const authHeader = c.req.header("Authorization");
    const token = authHeader?.startsWith("Bearer ")
      ? authHeader.replace("Bearer ", "")
      : c.req.header("authToken");

    if (!token) {
      return c.json({ status_code: 401, description: "Missing auth token" }, 401);
    }

    c.set("authToken", token);
    await next();
  };
}
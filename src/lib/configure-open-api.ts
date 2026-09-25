import { Scalar } from "@scalar/hono-api-reference";

import type { AppOpenAPI } from "./types";

import packageJSON from "../../package.json" with { type: "json" };

const scalarConfig = Scalar({
  url: "/doc",
  theme: "kepler",
  layout: "classic",
  defaultHttpClient: {
    targetKey: "js",
    clientKey: "fetch",
  },
});

export default function configureOpenAPI(app: AppOpenAPI) {
  app.get("/doc", (c) => {
    const document = app.getOpenAPIDocument({
      openapi: "3.0.0",
      info: {
        version: packageJSON.version,
        title: "Blasta SMS API",
        description: "Dmark Mobile Blasta v3 SMS API",
      },
    });

    for (const path of ["/v3/api/get_token", "/v3/api/send_sms", "/v3/api/dlr"]) {
      const pathItem = document.paths?.[path];
      if (pathItem) {
        document.paths[`${path}/`] = pathItem;
        delete document.paths[path];
      }
    }

    for (const pathItem of Object.values(document.paths ?? {})) {
      const requestBody = pathItem?.post?.requestBody;
      if (requestBody && "content" in requestBody) {
        requestBody.required = true;
      }
      for (const parameter of pathItem?.post?.parameters ?? []) {
        if (parameter && "name" in parameter && parameter.name === "authToken") {
          parameter.required = true;
        }
      }
    }

    return c.json(document);
  });

  app.get("/reference", scalarConfig);
  app.get("/docs", scalarConfig);
}

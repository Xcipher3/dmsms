import { createRouter } from "@/lib/create-app";

import * as handlers from "./sms.handlers";
import * as routes from "./sms.routes";

const router = createRouter()
  .openapi(routes.sendSms, handlers.sendSms)
  .openapi(routes.getDlr, handlers.getDlr)
  .openapi(routes.getToken, handlers.getToken)
  .openapi(routes.optOut, handlers.optOut)
  .openapi(routes.optIn, handlers.optIn)
  .openapi(routes.listOptOuts, handlers.listOptOuts);

export default router;

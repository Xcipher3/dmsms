import * as HttpStatusCodes from "stoker/http-status-codes";

import { createRouter } from "@/lib/create-app";

import * as handlers from "./sms.handlers";
import * as routes from "./sms.routes";

const router = createRouter()
  .openapi(routes.getToken, handlers.getToken)
  .openapi(routes.sendSms, handlers.sendSms, (result, c) => {
    if (!result.success) {
      return c.json(
        { msg_id: "", status_code: "400", description: "Invalid message format" },
        HttpStatusCodes.BAD_REQUEST,
      );
    }
    return undefined;
  })
  .openapi(routes.getDlr, handlers.getDlr, (result, c) => {
    if (!result.success) {
      return c.json(
        {
          msg_id: "",
          status_code: "400",
          description: "Provide a message ID using 'msgId' or 'msg_id'",
        },
        HttpStatusCodes.BAD_REQUEST,
      );
    }
    return undefined;
  });

export default router;

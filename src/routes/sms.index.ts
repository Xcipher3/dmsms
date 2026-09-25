import * as HttpStatusCodes from "stoker/http-status-codes";

import { createRouter } from "@/lib/create-app";
import { authMiddleware } from "@/middlewares/auth";

import * as handlers from "./sms.handlers";
import * as routes from "./sms.routes";

const router = createRouter();
router.openapi(routes.getToken, handlers.getToken, (result, c) => {
  if (!result.success) {
    return c.json({
      access_token: "",
      description: "Could not process request, confirm parameters.",
      status_code: "400",
    }, HttpStatusCodes.BAD_REQUEST);
  }
});
router.use(authMiddleware());
router.openapi(routes.sendSms, handlers.sendSms, (result, c) => {
  if (!result.success) {
    return c.json({
      msg_id: "",
      status_code: "400",
      description: "Invalid message format",
    }, HttpStatusCodes.BAD_REQUEST);
  }
});
router.openapi(routes.getDlr, handlers.getDlr, (result, c) => {
  if (!result.success) {
    return c.json({
      msg_id: "",
      status_code: "400",
      description: "Provide a message ID using 'msgId' or 'msg_id'",
    }, HttpStatusCodes.BAD_REQUEST);
  }
});

export default router;

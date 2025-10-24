import express from "express"
import { getUserDataUsageBySimId } from "../../controllers/user/userEsimUsage.controller";
import { thirdPartyAuthMiddleware } from "../../middlewares/thirdPartyApi.handler";

const router = express.Router();

router.get("/:esimId", thirdPartyAuthMiddleware, getUserDataUsageBySimId);

export default router;
import { Router } from "express";
import { thirdPartyLogin } from "../../controllers/admin/adminThirdAPI.controllers";
import thirdPartyServiceRoute from "../thirdPartyApi/thirdParty.route"
import { auth } from "../../middlewares/auth.handler";
import { thirdPartyAuthMiddleware } from "../../middlewares/thirdPartyApi.handler";
const router = Router();

router.get("/login", auth, thirdPartyLogin);
router.use("/services", thirdPartyAuthMiddleware, thirdPartyServiceRoute)

export default router;

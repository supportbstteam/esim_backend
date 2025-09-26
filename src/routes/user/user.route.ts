import { Router } from "express";
import userAuth from "./userAuth.route"
import countryAuth from "./userCountry.route"
import eSim from "./userEsim.route"
import topUpPlan from "./userTopupPlan.route"
import { auth } from "../../middlewares/auth.handler";
const router = Router();

router.post("/auth", userAuth);
router.post("/country", countryAuth);
router.post("/plans", eSim);
router.post("/top-up", auth, topUpPlan);
router.post("/e-sim", eSim);

export default router;

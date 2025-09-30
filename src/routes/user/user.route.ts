import { Router } from "express";
import userAuth from "./userAuth.route"
import countryAuth from "./userCountry.route"
import topUpPlanRoute from "./userTopupPlan.route"
import esimRoute from "./userEsim.route"
import planRoute from "./userPlans.route"
import { auth } from "../../middlewares/auth.handler";
const router = Router();

router.post("/auth", userAuth);
router.use("/country", countryAuth);
router.use("/plans", planRoute); // pass countryId = "all" to get all the avaiable plans in DB
router.use("/top-up", auth, topUpPlanRoute);
router.use("/e-sim", esimRoute);

export default router;


/**
 * If user opt our service and buy one e-sim that auto detect the e-sim validation 
 * according to the on going e-sim user must see the top up plans 
 * filter the suggestion with the help user where esim is from and provide according to that suggestion
 */
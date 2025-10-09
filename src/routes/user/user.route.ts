import { Router } from "express";
import userAuth from "./userAuth.route"
import countryRoute from "./userCountry.route"
import topUpPlanRoute from "./userTopupPlan.route"
import esimRoute from "./userEsim.route"
import planRoute from "./userPlans.route"
import useContactRoute from "./userContact.route";
import userQuickies from "./userQuickies.route";
import userSupport from "./userSupport.route";
import { auth } from "../../middlewares/auth.handler";
import queryRoute from "../query.routes"
import { getUserDetails, postCreateUser, postUserLogin, postVerifyOtp } from "../../controllers/user/userAuth.controllers";
import { getSocials } from "../../controllers/Social.Media.controllers";
import { postOrder } from "../../controllers/user/userEsimControlllers";
import { thirdPartyAuthMiddleware } from "../../middlewares/thirdPartyApi.handler";
const router = Router();


// Public
router.post("/verify-otp", postCreateUser);
router.post("/signup", postVerifyOtp);
router.post("/login", postUserLogin);
router.get("/details", auth, getUserDetails);


router.use("/country", countryRoute);
router.use("/plans", planRoute);
router.use("/top-up", auth, topUpPlanRoute);
router.use("/e-sim", auth, esimRoute);

router.post("/add-to-cart",()=>{

});

router.post("/order",auth,thirdPartyAuthMiddleware,postOrder);

router.use("/cms", useContactRoute);
router.get("/social-media", getSocials);

// ---- quickies -----
router.use("/quick-links", userQuickies);

// ---- support ----
router.use("/support", userSupport);

// ---- query ------
router.use("/query", queryRoute);

// handlling the post for the content and social media query

export default router;


/**
 * If user opt our service and buy one e-sim that auto detect the e-sim validation 
 * according to the on going e-sim user must see the top up plans 
 * filter the suggestion with the help user where esim is from and provide according to that suggestion
 */
import express from 'express'
import { adminDetails, loginAdmin, registerAdmin } from '../../controllers/admin/adminAuth.controllers';
import eSimPlanRoute from "./adminEPlan.route"
import adminCountryRoute from "./adminCountry.route"
import eSimOperatorRoute from "./adminOperator.route"
import thirdPartyRouter from "./thirdPartyUrl.route"
import eSimRoute from "./adminESim.route"
import eTopupRoute from "./adminETopup.route"
import adminUserRouter from "./adminUser.route"
import adminContactRouter from "./adminContact.route"
import adminSocialRouter from "./adminSocial.route"
import contentRouter from './adminContent.route'
import queryRoute from "../query.routes"
import adminOrderRouter from "./adminOrder.route"
import { auth } from '../../middlewares/auth.handler';
const router = express.Router();

router.post("/login", loginAdmin);
router.post("/register", registerAdmin);
router.get("/details", auth, adminDetails);

// countries
router.use("/countries", auth, adminCountryRoute);

// operator
router.use("/operator", auth, eSimOperatorRoute);
router.use("/third-party-api", auth, thirdPartyRouter); // third party library api

// plans
router.use("/plans", auth, eSimPlanRoute);

// users
router.use("/users", auth, adminUserRouter);

// order
router.use("/orders", auth, adminOrderRouter);

// top up
router.use("/top-up", auth, eTopupRoute);

//e-sim
router.use("/e-sim", auth, eSimRoute);

// contact
router.use("/contact", auth, adminContactRouter);
router.use("/social-media", auth, adminSocialRouter);
router.use("/content", auth, contentRouter);

// query
router.use("/query", auth, queryRoute);



export default router;
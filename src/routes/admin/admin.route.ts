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
router.get("/details", adminDetails);

// countries
router.use("/countries", adminCountryRoute);

// operator
router.use("/operator", eSimOperatorRoute);
router.use("/third-party-api", thirdPartyRouter); // third party library api

// plans
router.use("/plans", eSimPlanRoute);

// users
router.use("/users", adminUserRouter);

// order
router.use("/orders", adminOrderRouter);

// top up
router.use("/top-up", eTopupRoute);

//e-sim
router.use("/e-sim", eSimRoute);

// contact
router.use("/contact", adminContactRouter);
router.use("/social-media", adminSocialRouter);
router.use("/content", contentRouter);

// query
router.use("/query", queryRoute);



export default router;
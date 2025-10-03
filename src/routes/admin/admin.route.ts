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

// plans
router.use("/users", adminUserRouter);

// top up
router.use("/top-up", eTopupRoute);

//e-sim
router.use("/e-sim", eSimRoute);

// contact
router.use("/contact", adminContactRouter);
router.use("/social-media", adminSocialRouter);
router.use("/content", contentRouter);

// note



export default router;
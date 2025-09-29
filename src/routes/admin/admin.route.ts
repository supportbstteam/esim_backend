import express from 'express'
import { adminDetails, loginAdmin, registerAdmin } from '../../controllers/admin/adminAuth.controllers';
import eSimPlanRoute from "./adminEPlan.route"
import adminCountryRoute from "./adminCountry.route"
import eSimOperatorRoute from "./adminOperator.route"
import thirdPartyRouter from "./thirdPartyUrl.route"
import eSimRoute from "./adminESim.route"
import eTopupRoute from "./adminETopup.route"
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

// top up
router.use("/top-up", eTopupRoute);

//e-sim
router.use("/e-sim", eSimRoute);

// note



export default router;
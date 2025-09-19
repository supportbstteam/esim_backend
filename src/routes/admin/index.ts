import express from 'express'
import { adminDetails, loginAdmin, registerAdmin } from '../../controllers/admin/auth/login';
import eSimRoute from './eSimRoute'
import eSimPlanRoute from './eSimPlans.routes'
import adminCRoute from './countries.route'
import eSimOperatorRoute from './eSimOperator.route'
import operatorRoute from "../plan.route"
const router = express.Router();

router.post("/login", loginAdmin);
router.post("/register", registerAdmin);
router.get("/details", adminDetails);

// countries
router.use("/countries", adminCRoute);

// operator
router.use("/operator", eSimOperatorRoute);
router.use("/operator-plans", operatorRoute);

// plans
router.use("/plans", eSimPlanRoute);

//e-sim
router.use("/e-sim", eSimRoute);



export default router;
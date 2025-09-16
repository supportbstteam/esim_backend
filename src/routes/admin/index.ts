import express from 'express'
import { adminDetails, loginAdmin, registerAdmin } from '../../controllers/admin/auth/login';
import eSimRoute from './eSimRoute'
import eSimPlanRoute from './eSimPlans.routes'
const router = express.Router();

router.post("/login", loginAdmin);
router.post("/register", registerAdmin);
router.get("/details", adminDetails);

//e-sim
router.use("/e-sim", eSimRoute);

// plans
router.use("/plans", eSimPlanRoute);

export default router;
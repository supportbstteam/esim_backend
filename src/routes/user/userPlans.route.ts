import express from 'express'
import { getFeaturePlans, getUserPlanByCountry, getUserPlans } from '../../controllers/user/userPlans.controllers';
import { getPlanById } from '../../controllers/admin/adminPlans.controllers';

const router = express.Router();
router.get("/", getUserPlans); // fixed
router.get("/feature", getFeaturePlans); // fixed
router.get("/:planId", getPlanById) // fixed
export default router;
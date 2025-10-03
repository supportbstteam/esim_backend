import express from 'express'
import { getFeaturePlans, getUserPlanByCountry, getUserPlans } from '../../controllers/user/userPlans.controllers';

const router = express.Router();
router.get("/", getUserPlans); // all country and can add query as well to find the plans by country id
router.get("/feature", getFeaturePlans); // all country and can add query as well to find the plans by country id

export default router;
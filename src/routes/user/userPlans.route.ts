import express from 'express'
import { getUserPlanByCountry, getUserPlans } from '../../controllers/user/userPlans.controllers';

const router = express.Router();
router.get("/", getUserPlans); // all country and can add query as well to find the plans by country id

export default router;
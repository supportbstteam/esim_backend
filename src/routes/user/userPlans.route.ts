import express from 'express'
import { getUserPlans } from '../../controllers/user/userPlans.controllers';

const router = express.Router();
router.get("/", getUserPlans);

export default router;
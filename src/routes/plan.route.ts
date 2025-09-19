import express from 'express'
import { getOperatorPlans } from '../controllers/OperatorPlans';

const router = express.Router();

router.get("/", getOperatorPlans)

export default router;
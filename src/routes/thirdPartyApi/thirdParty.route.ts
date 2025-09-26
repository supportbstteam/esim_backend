import axios from "axios";
import express from "express";
import { thirdPartyGetPlans, thirdPartyGetTopup } from "../../controllers/admin/adminThirdAPI.controllers";

const router = express.Router();
// plan
router.get("/plans", thirdPartyGetPlans);

// top up plans
router.get("/top-up", thirdPartyGetTopup);

export default router;
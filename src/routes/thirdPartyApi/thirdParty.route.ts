import axios from "axios";
import express from "express";
import { postImportThirdPartyPlans, postImportTopUpPlans, thirdPartyGetPlans, thirdPartyGetTopup } from "../../controllers/admin/adminThirdAPI.controllers";

const router = express.Router();
// plan
router.get("/plans", thirdPartyGetPlans);

// top up plans
router.get("/top-up", thirdPartyGetTopup);

router.post("/import", postImportThirdPartyPlans)
router.post("/import-topup", postImportTopUpPlans)

export default router;
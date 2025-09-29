import { Router } from "express";
import { createTopupPlans, deleteTopupPlan, getTopupPlanById, getTopupPlans, updateTopupPlan } from "../../controllers/admin/adminTopup.controllers";

const router = Router();

router.post("/create-topup", createTopupPlans);
router.get("/", getTopupPlans);
router.get("/:topupId", getTopupPlanById);
router.put("/:topupId", updateTopupPlan);
router.delete("/:topupId", deleteTopupPlan);

export default router;

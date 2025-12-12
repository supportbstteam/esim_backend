import { Router } from "express";
import { createTopupPlans, deleteTopupPlan, getTopupPlanById, getTopupPlans, postStatusChangeTopup, updateTopupPlan } from "../../controllers/admin/adminTopup.controllers";

const router = Router();

router.post("/create-topup", createTopupPlans);

router.post("/status/:id",postStatusChangeTopup)
router.get("/", getTopupPlans);
router.get("/:id", getTopupPlanById);
router.put("/:id", updateTopupPlan);
router.delete("/:id", deleteTopupPlan);


export default router;

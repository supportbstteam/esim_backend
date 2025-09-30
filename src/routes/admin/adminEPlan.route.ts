import { Router } from "express";
import { createPlan, getPlanById, getPlans, updatePlan, deletePlan, postImportPlans, postStatusChangePlan } from "../../controllers/admin/adminPlans.controllers";

const router = Router();
// always take care of the order of routes
router.post("/create-plan", createPlan);
router.get("/", getPlans);
router.get("/:planId", getPlanById);
router.put("/:planId", updatePlan);
router.delete("/:planId", deletePlan);

router.post("/import", postImportPlans);
router.post("/status/:id", postStatusChangePlan);

export default router;

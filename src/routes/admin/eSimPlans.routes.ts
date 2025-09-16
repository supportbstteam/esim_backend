import { Router } from "express";
import { createPlan, deletePlan, getAllPlans, getPlanById, updatePlan } from "../../controllers/eSim/admin/adminESimPlan.controllers";
// import { createPlan, getAllPlans, getPlanById, updatePlan, deletePlan } from "../controllers/planController";

const router = Router();

router.post("/create-plan", createPlan);
router.get("/", getAllPlans);
router.get("/:id", getPlanById);
router.put("/:id", updatePlan);
router.delete("/:id", deletePlan);

export default router;

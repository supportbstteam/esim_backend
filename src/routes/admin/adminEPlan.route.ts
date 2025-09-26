import { Router } from "express";
import { createUser, getUsers } from "../../controllers/user/user.controllers";
import { createPlan, getPlanById, getPlans, updatePlan, deletePlan } from "../../controllers/admin/adminPlans.controllers";

const router = Router();

router.post("/create-plan", createPlan);
router.get("/", getPlans);
router.get("/:planId", getPlanById);
router.put("/:planId", updatePlan);
router.delete("/:planId", deletePlan);

export default router;

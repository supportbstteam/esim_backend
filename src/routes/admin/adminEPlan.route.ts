import { Router } from "express";
import { createPlan, getPlanById, getPlans, updatePlan, deletePlan, postImportPlans, postStatusChangePlan, postAddFeaturingPlan, exportPlansExcel, importPlansExcel } from "../../controllers/admin/adminPlans.controllers";
import multer from "multer";

const router = Router();

// do not need to make another functionality when we have made the export function already
const upload = multer({ storage: multer.memoryStorage() });

// always take care of the orderzdfsdfd of routes dssdsd
router.get("/export", exportPlansExcel);

// router.post("/import-excel", upload.single("file"), importPlansExcel);

router.post("/create-plan", createPlan);
router.get("/", getPlans);
router.get("/:planId", getPlanById);
router.put("/:planId", updatePlan);
router.delete("/:planId", deletePlan);

router.post("/import", postImportPlans);
router.post("/status/:id", postStatusChangePlan);
router.post("/feature/:id", postAddFeaturingPlan);

export default router;

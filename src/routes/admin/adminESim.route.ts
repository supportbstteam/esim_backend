import { Router } from "express";
import { adminDeletingESim, adminUserAllESimById, adminUserAllESims } from "../../controllers/admin/adminUserESim.controllers";

const router = Router();
router.get("/all", adminUserAllESims);
router.get("/:id", adminUserAllESimById);
router.delete("/:id", adminDeletingESim);

export default router;

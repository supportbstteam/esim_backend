import { Router } from "express";
import { createESim, deleteESim, getAllESims, getESimById, updateESim } from "../../controllers/eSim/admin/adminESimController";

const router = Router();

router.post("/create-sim", createESim);
router.get("/", getAllESims);
router.get("/:id", getESimById);
router.put("/:id", updateESim);
router.delete("/:id", deleteESim);

export default router;

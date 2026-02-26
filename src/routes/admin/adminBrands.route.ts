import express from "express";
import { createBrand, createSingleBrand, deleteBrand, getBrands, restoreBrand, softDeleteBrand, updateBrand } from "../../controllers/admin/adminDevice.controllers";

const router = express.Router();


// =============================
// GET — Fetch all brands
// =============================
router.get("/", getBrands);


// =============================
// POST — Create single/multiple
// =============================
router.post("/add-bulk", createBrand);
router.post("/add", createSingleBrand);


// =============================
// DELETE — Remove brand
// Cascade deletes devices
// =============================
router.delete("/:id", deleteBrand);

router.put("/:id", updateBrand);

router.patch("/:id/disable", softDeleteBrand);
router.patch("/:id/restore", restoreBrand);


export default router;

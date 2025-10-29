import { Router } from "express";
import { createTestimonial, getAllTestimonials, getTestimonialById, updateTestimonial, deleteTestimonial } from "../../controllers/admin/adminTestimonials.controllers";

const router = Router();

router.post("/", createTestimonial);
router.get("/", getAllTestimonials);
router.get("/:id", getTestimonialById);
router.put("/:id", updateTestimonial);
router.delete("/:id", deleteTestimonial);

export default router;

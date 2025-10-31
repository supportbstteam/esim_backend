import express from "express";
import {
    getFaqs,
    getFaqById,
    createFaq,
    updateFaq,
    updateFaqStatus,
    deleteFaq,
} from "../../controllers/Faq.controllers";

const router = express.Router();

router.get("/", getFaqs);
router.get("/:id", getFaqById);
router.post("/", createFaq);
router.put("/:id", updateFaq);
router.patch("/:id/status", updateFaqStatus); // ✅ toggle active/inactive
router.delete("/:id", deleteFaq);

export default router;

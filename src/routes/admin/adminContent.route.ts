import { Router } from "express";
import { getAllContent, getContent, saveContent } from "../../controllers/Content.controllers";
import { createFaq, deleteFaq, getFaqById, getFaqs, updateFaq } from "../../controllers/Faq.controllers";


const router = Router();

router.get("/:page", getContent);
router.get("/", getAllContent);
router.post("/", saveContent);
// ----------------------------
router.get("/faq", getFaqs);
router.get("/faq/:id", getFaqById);
router.post("/create-faq", createFaq);
router.patch("/update-faq/:id", updateFaq);
router.delete("/delete-faq/:id", deleteFaq);

export default router;

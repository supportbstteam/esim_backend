// controllers/faq.controller.ts
import { Request, Response } from "express";
import { AppDataSource } from "../data-source";
import { Faq } from "../entity/Faq.entity";
import { checkAdmin } from "../utils/checkAdmin";

const faqRepo = AppDataSource.getRepository(Faq);

// ✅ Get all active FAQs
export const getFaqs = async (req: Request, res: Response) => {
    try {
        const faqs = await faqRepo.find({
            order: { order: "ASC" },
            where: { isActive: true },
        });
        res.json(faqs);
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err });
    }
};

// ✅ Get FAQ by ID
export const getFaqById = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const faq = await faqRepo.findOne({ where: { id } });
        if (!faq) return res.status(404).json({ message: "FAQ not found" });
        res.json(faq);
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err });
    }
};

// ✅ Create one or multiple FAQs
export const createFaq = async (req: Request, res: Response) => {
    try {
        const adminCheck = await checkAdmin(req, res);
        if (!adminCheck) return;

        const faqs = Array.isArray(req.body) ? req.body : [req.body];

        if (!faqs.length) {
            return res.status(400).json({ message: "FAQ data is required" });
        }

        for (const f of faqs) {
            if (!f.question?.trim() || !f.answer?.trim()) {
                return res.status(400).json({ message: "Each FAQ must include question and answer" });
            }
        }

        const newFaqs = faqRepo.create(faqs);
        const savedFaqs = await faqRepo.save(newFaqs);

        return res.status(201).json({
            message: `${savedFaqs.length} FAQ(s) created successfully`,
            data: savedFaqs,
        });
    } catch (err) {
        console.error("Error creating FAQs:", err);
        return res.status(500).json({ message: "Error creating FAQs", error: err });
    }
};

// ✅ Update FAQ (all fields required)
export const updateFaq = async (req: Request, res: Response) => {
    try {
        const adminCheck = await checkAdmin(req, res);
        if (!adminCheck) return;

        const { id } = req.params;
        const { question, answer, order, isActive } = req.body;

        // Require at least question and answer for update
        if (!question?.trim() || !answer?.trim()) {
            return res.status(400).json({
                message: "Both 'question' and 'answer' are required to update a FAQ",
            });
        }

        const faq = await faqRepo.findOne({ where: { id } });
        if (!faq) return res.status(404).json({ message: "FAQ not found" });

        faq.question = question.trim();
        faq.answer = answer.trim();
        if (order !== undefined) faq.order = order;
        if (typeof isActive === "boolean") faq.isActive = isActive;

        const updatedFaq = await faqRepo.save(faq);
        return res.json({ message: "FAQ updated successfully", data: updatedFaq });
    } catch (err) {
        console.error("Error updating FAQ:", err);
        res.status(500).json({ message: "Error updating FAQ", error: err });
    }
};

// ✅ Update FAQ active/inactive status only
export const updateFaqStatus = async (req: Request, res: Response) => {
    try {
        const adminCheck = await checkAdmin(req, res);
        if (!adminCheck) return;

        const { id } = req.params;
        const { isActive } = req.body;

        if (typeof isActive !== "boolean") {
            return res.status(400).json({ message: "'isActive' must be a boolean" });
        }

        const faq = await faqRepo.findOne({ where: { id } });
        if (!faq) return res.status(404).json({ message: "FAQ not found" });

        faq.isActive = isActive;
        const updatedFaq = await faqRepo.save(faq);

        res.json({
            message: `FAQ ${isActive ? "activated" : "deactivated"} successfully`,
            data: updatedFaq,
        });
    } catch (err) {
        console.error("Error updating FAQ status:", err);
        res.status(500).json({ message: "Error updating FAQ status", error: err });
    }
};

// ✅ Delete FAQ
export const deleteFaq = async (req: Request, res: Response) => {
    try {
        const adminCheck = await checkAdmin(req, res);
        if (!adminCheck) return;

        const { id } = req.params;
        const faq = await faqRepo.findOne({ where: { id } });
        if (!faq) return res.status(404).json({ message: "FAQ not found" });

        await faqRepo.remove(faq);
        res.json({ message: "FAQ deleted successfully" });
    } catch (err) {
        res.status(500).json({ message: "Error deleting FAQ", error: err });
    }
};

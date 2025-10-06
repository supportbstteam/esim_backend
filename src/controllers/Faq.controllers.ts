// controllers/faq.controller.ts
import { Request, Response } from "express";
import { AppDataSource } from "../data-source";
import { Faq } from "../entity/Faq.entity";
import { checkAdmin } from "../utils/checkAdmin";

const faqRepo = AppDataSource.getRepository(Faq);

// Get all FAQs
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

// Get FAQ by ID
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
        // Verify admin
        const adminCheck = await checkAdmin(req, res);
        if (!adminCheck) return; // checkAdmin will handle the response if unauthorized

        const faqs = Array.isArray(req.body) ? req.body : [req.body];

        if (!faqs.length) {
            return res.status(400).json({ message: "FAQ data is required" });
        }

        const newFaqs = faqRepo.create(faqs);
        const savedFaqs = await faqRepo.save(newFaqs);

        return res.status(201).json({
            message: `${savedFaqs.length} FAQ(s) created successfully`,
            data: savedFaqs,
        });
    } catch (err) {
        console.error("Error creating FAQs:", err);
        return res
            .status(500)
            .json({ message: "Error creating FAQs", error: err });
    }
};

// ✅ Update FAQ
export const updateFaq = async (req: Request, res: Response) => {
    try {
        const adminCheck = await checkAdmin(req, res);
        if (!adminCheck) return;

        const { id } = req.params;
        const faq = await faqRepo.findOne({ where: { id } });
        if (!faq) return res.status(404).json({ message: "FAQ not found" });

        faqRepo.merge(faq, req.body);
        const updatedFaq = await faqRepo.save(faq);
        res.json({ message: "FAQ updated successfully", data: updatedFaq });
    } catch (err) {
        res.status(500).json({ message: "Error updating FAQ", error: err });
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
import { Request, Response } from "express";
import { AppDataSource } from "../data-source";
import { Content } from "../entity/Content.entity";
import { QueryFailedError } from "typeorm";

const contentRepo = AppDataSource.getRepository(Content);

// 🟢 Get content by page
export const getContent = async (req: Request, res: Response) => {
    const { page } = req.params;

    try {
        if (!page) return res.status(400).json({ message: "Page parameter is required" });

        const content = await contentRepo.findOne({ where: { page } });
        if (!content) {
            return res.status(404).json({ message: "Content not found", page });
        }

        res.status(200).json({
            message: "Content fetched successfully",
            page: content.page,
            html: content.html,
            title: content.title,
        });
    } catch (err) {
        console.error("Error fetching content:", err);
        res.status(500).json({ message: "Server error", error: (err as Error).message });
    }
};

// 🟡 Get all content pages
export const getAllContent = async (_req: Request, res: Response) => {
    try {
        const contents = await contentRepo.find({
            order: { updatedAt: "DESC" }, // newest first
        });

        if (!contents.length) {
            return res.status(404).json({ message: "No content found" });
        }

        res.status(200).json({
            message: "Content fetched successfully",
            contents,
        });
    } catch (err) {
        console.error("Error fetching contents:", err);
        res.status(500).json({
            message: "Server error while fetching contents",
            error: (err as Error).message,
        });
    }
};

// 🔵 Save or update content
export const saveContent = async (req: Request, res: Response) => {
    const { page, html, title } = req.body;

    if (!page || !html || !title) {
        return res.status(400).json({ message: "Page, title, and HTML are required" });
    }

    try {
        // Try to find existing content by page
        let content = await contentRepo.findOne({ where: { page } });

        if (content) {
            // 📝 Update existing
            content.html = html;
            content.title = title;
            await contentRepo.save(content);

            return res.status(200).json({
                message: "Content updated successfully",
                content,
            });
        } else {
            // 🆕 Create new
            const newContent = contentRepo.create({ page, html, title });
            await contentRepo.save(newContent);

            return res.status(201).json({
                message: "Content created successfully",
                content: newContent,
            });
        }
    } catch (err: any) {
        console.error("Error saving content:", err);

        // 🧩 Handle duplicate key (unique constraint) error gracefully
        if (err instanceof QueryFailedError && err.message.includes("Duplicate entry")) {
            return res.status(400).json({
                message: "Duplicate value detected. 'page' or 'title' must be unique.",
                error: err.message,
            });
        }

        res.status(500).json({
            message: "Server error while saving content",
            error: err.message || err,
        });
    }
};

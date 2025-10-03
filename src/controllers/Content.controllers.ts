import { Request, Response } from "express";
import { AppDataSource } from "../data-source";
import { Content } from "../entity/Content.entity";

const contentRepo = AppDataSource.getRepository(Content);

// Get content by page
export const getContent = async (req: Request, res: Response) => {
    const { page } = req.params;
    try {
        const content = await contentRepo.findOne({ where: { page } });
        if (!content)
            return res.status(404).json({ message: "Content not found", page });

        // Send page along with html
        res.json({ page: content.page, html: content.html });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err });
    }
};

// Save or update content
export const saveContent = async (req: Request, res: Response) => {
    const { page, html } = req.body;

    if (!page || !html)
        return res.status(400).json({ message: "Page and HTML required" });

    try {
        let content = await contentRepo.findOne({ where: { page } });

        if (content) {
            content.html = html;
            await contentRepo.save(content);
        } else {
            content = contentRepo.create({ page, html });
            await contentRepo.save(content);
        }

        res.json({ message: "Content saved successfully", content: { page: content.page, html: content.html } });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err });
    }
};

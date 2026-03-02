// src/controllers/image.controller.ts
import { Request, Response } from "express";
import { AppDataSource } from "../data-source";
import { Image } from "../entity/Images.entity";
import { ILike } from "typeorm";

export const uploadImageToDesktop = async (
    req: any,
    res: Response
) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                message: "No image file received",
            });
        }


        const imageRepo = AppDataSource.getRepository(Image);

        const image = imageRepo.create({
            originalName: req.file.originalname,
            fileName: req.file.filename,
            mimeType: req.file.mimetype,
            size: req.file.size,
            name: req.body.name || null,
            filePath: `/uploadsimg/${req.file.filename}`,
        });

        await imageRepo.save(image);

        return res.status(201).json({
            message: "Image stored on desktop successfully",
            data: image,
        });
    } catch (err: any) {
        return res.status(500).json({
            message: "Image upload failed",
            error: err.message,
        });
    }
};

export const getAdminImages = async (req: Request, res: Response) => {
    try {
        const page = Number(req.query.page) || 1;
        const limit = Math.min(Number(req.query.limit) || 10, 50);
        const search = (req.query.search as string) || "";

        const repo = AppDataSource.getRepository(Image);

        const query = repo.createQueryBuilder("image");

        if (search) {
            query.andWhere(
                "(image.name ILIKE :search OR image.originalName ILIKE :search)",
                { search: `%${search}%` }
            );
        }

        const [images, total] = await query
            .orderBy("image.createdAt", "DESC")
            .skip((page - 1) * limit)
            .take(limit)
            .getManyAndCount();

        return res.status(200).json({
            data: images,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (err: any) {
        return res.status(500).json({
            message: "Failed to fetch images",
            error: err.message,
        });
    }
};

export const getAdminImageById = async (req: Request, res: Response) => {
    try {
        const repo = AppDataSource.getRepository(Image);
        const image = await repo.findOneBy({ id: Number(req.params.id) });

        if (!image) {
            return res.status(404).json({ message: "Image not found" });
        }

        return res.status(200).json(image);
    } catch (err: any) {
        return res.status(500).json({
            message: "Failed to fetch image",
            error: err.message,
        });
    }
};


export const updateAdminImage = async (req: Request, res: Response) => {
    try {
        const repo = AppDataSource.getRepository(Image);
        const image = await repo.findOneBy({ id: Number(req.params.id) });

        if (!image) {
            return res.status(404).json({ message: "Image not found" });
        }

        image.name = req.body.name ?? image.name;

        await repo.save(image);

        return res.status(200).json({
            message: "Image updated successfully",
            data: image,
        });
    } catch (err: any) {
        return res.status(500).json({
            message: "Failed to update image",
            error: err.message,
        });
    }
};

export const deleteAdminImage = async (req: Request, res: Response) => {
    try {
        const repo = AppDataSource.getRepository(Image);
        const image = await repo.findOneBy({ id: Number(req.params.id) });

        if (!image) {
            return res.status(404).json({ message: "Image not found" });
        }

        await repo.remove(image);

        return res.status(200).json({
            message: "Image deleted successfully",
        });
    } catch (err: any) {
        return res.status(500).json({
            message: "Failed to delete image",
            error: err.message,
        });
    }
};
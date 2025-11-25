import { Request, Response } from "express";
import { AppDataSource } from "../data-source";
import { Social } from "../entity/SocialMedia.entity";

const socialRepo = AppDataSource.getRepository(Social);

// ✅ Get all socials
export const getSocials = async (_req: Request, res: Response) => {
    try {
        const socials = await socialRepo.find();

        // console.log("-=-=-=-=-= socials medias -=-=-=-=-=-=", socials);
        return res.json(socials);
    } catch (err) {
        return res.status(500).json({ message: "Error fetching socials", error: err });
    }
};

// ✅ Add multiple socials
export const createSocials = async (req: Request, res: Response) => {
    try {
        const socials = req.body; // expects an array of socials
        if (!Array.isArray(socials) || socials.length === 0) {
            return res.status(400).json({ message: "Socials array is required" });
        }

        const newSocials = socialRepo.create(socials);
        await socialRepo.save(newSocials);

        return res.status(201).json(newSocials);
    } catch (err) {
        return res.status(500).json({ message: "Error creating socials", error: err });
    }
};

// ✅ Update a single social
export const updateSocial = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        const social = await socialRepo.findOneBy({ id });
        if (!social) return res.status(404).json({ message: "Social not found" });

        socialRepo.merge(social, updates);
        const saved = await socialRepo.save(social);

        return res.json(saved);
    } catch (err) {
        return res.status(500).json({ message: "Error updating social", error: err });
    }
};

// ✅ Delete a social
export const deleteSocial = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const social = await socialRepo.findOneBy({ id });
        if (!social) return res.status(404).json({ message: "Social not found" });

        await socialRepo.remove(social);
        return res.json({ message: "Social deleted successfully" });
    } catch (err) {
        return res.status(500).json({ message: "Error deleting social", error: err });
    }
};

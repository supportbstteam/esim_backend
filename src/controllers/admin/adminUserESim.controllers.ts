import { Request, Response } from "express";
import { AppDataSource } from "../../data-source";
import { Esim } from "../../entity/Esim.entity";
import { User } from "../../entity/User.entity";

/**
 * ✅ 1. Get all eSIMs across all users
 */
export const adminUserAllESims = async (req: Request, res: Response) => {
    try {
        const esimRepo = AppDataSource.getRepository(Esim);

        const allEsims = await esimRepo.find({
            relations: ["user", "order"], // include user + order info
            order: { createdAt: "DESC" },
        });

        return res.status(200).json({
            success: true,
            message: "All eSIMs fetched successfully.",
            data: allEsims,
        });
    } catch (error) {
        console.error("Error fetching all eSIMs:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch eSIMs.",
            error: error instanceof Error ? error.message : error,
        });
    }
};

/**
 * ✅ 2. Get all eSIMs for a specific user (by userId)
 */
export const adminUserAllESimById = async (req: Request, res: Response) => {
    try {
        const { userId } = req.params;

        const userRepo = AppDataSource.getRepository(User);
        const user = await userRepo.findOne({
            where: { id: userId },
            relations: ["simIds"],
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found.",
            });
        }

        return res.status(200).json({
            success: true,
            message: "User eSIMs fetched successfully.",
            data: user.simIds,
        });
    } catch (error) {
        console.error("Error fetching user eSIMs:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch user eSIMs.",
            error: error instanceof Error ? error.message : error,
        });
    }
};

/**
 * ✅ 3. Admin deletes a specific eSIM
 * Behavior: If admin deletes eSIM → user remains untouched.
 * The foreign key (userId) in Esim becomes NULL (via onDelete: "SET NULL").
 */
export const adminDeletingESim = async (req: Request, res: Response) => {
    try {
        const { esimId } = req.params;
        const esimRepo = AppDataSource.getRepository(Esim);

        const esim = await esimRepo.findOne({
            where: { id: esimId },
            relations: ["user"],
        });

        if (!esim) {
            return res.status(404).json({
                success: false,
                message: "eSIM not found.",
            });
        }

        await esimRepo.remove(esim);

        return res.status(200).json({
            success: true,
            message: `eSIM deleted successfully.`,
        });
    } catch (error) {
        console.error("Error deleting eSIM:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to delete eSIM.",
            error: error instanceof Error ? error.message : error,
        });
    }
};

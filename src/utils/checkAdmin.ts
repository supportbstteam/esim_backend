// src/middleware/checkAdmin.ts

import { Request, Response } from "express";
import { AppDataSource } from "../data-source";
import { Admin } from "../entity/Admin.entity";

export const checkAdmin = async (req: any, res: Response): Promise<boolean> => {
    const { id, role } = req.user;

    try {

        // get repository for Admin entity
        const adminRepo = AppDataSource.getRepository(Admin);

        // in TypeORM, use findOne instead of findById
        const admin = await adminRepo.findOne({ where: { id } });

        if (!admin) {
            res.status(403).json({ message: "Access denied. Not an active admin." });
            return false;
        }

        if (role !== "admin") {
            res.status(403).json({ message: "Invalid role." });
            return false;
        }

        return true;
    } catch (error) {
        // console.log("---error ---", error);
        res.status(500).json({ message: "Authorization failed", error });
        return false;
    }
};

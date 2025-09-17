import { Request, Response } from "express";
import adminModel from "../models/admin/adminModel";

export const checkAdmin = async (req: Request, res: Response): Promise<boolean> => {
    try {
        const { id, role } = (req as any).user; // from JWT/auth middleware
        const admin: any = await adminModel.findById(id);

        // console.log("---- id ----", id);
        // console.log("---- role ----", role);

        if (!admin) {
            res.status(403).json({ message: "Access denied. Not an active admin." });
            return false;
        }

        if (role !== 'admin') {
            res.status(403).json({ message: "Invalid role." });
            return false;
        }

        return true;
    } catch (error) {
        res.status(500).json({ message: "Authorization failed", error });
        return false;
    }
};
import { Request, Response } from "express";
import { AppDataSource } from "../data-source";
import { Query } from "../entity/Query.entity";
import { checkAdmin } from "../utils/checkAdmin";

const queryRepository = AppDataSource.getRepository(Query);


/* ================= USER ROUTES ================= */

// Create a new query (user)
export const createQuery = async (req: Request, res: Response) => {
    try {
        const { firstName, lastName, email, phone, message } = req.body;
        const newQuery = queryRepository.create({ firstName, lastName, email, phone, message });
        await queryRepository.save(newQuery);
        return res.status(201).json({ data: newQuery, status: true, message: "Thank you, Our expert will contact you soon" });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

// Get own query by email (user)
export const getQueryByEmail = async (req: Request, res: Response) => {
    try {
        const { email } = req.params;
        const query = await queryRepository.findOne({ where: { email, isDeleted: false } });

        if (!query) return res.status(404).json({ message: "Query not found" });
        return res.json(query);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

/* ================= ADMIN ROUTES ================= */

// Get all queries (admin)
export const getAllQueries = async (req: Request, res: Response) => {
    if (!checkAdmin(req, res)) return res.status(403).json({ message: "Unauthorized" });

    try {
        const queries = await queryRepository.find({ where: { isDeleted: false } });
        return res.json(queries);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

// Soft delete a query by ID (admin)
export const deleteQuery = async (req: Request, res: Response) => {
    if (!checkAdmin(req, res)) return res.status(403).json({ message: "Unauthorized" });

    try {
        const { id } = req.params;
        const query = await queryRepository.findOne({ where: { id, isDeleted: false } });

        if (!query) return res.status(404).json({ message: "Query not found" });

        query.isDeleted = true;
        await queryRepository.save(query);

        return res.json({ message: "Query deleted successfully (soft delete)" });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

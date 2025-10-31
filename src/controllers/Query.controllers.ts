import { Request, Response } from "express";
import { AppDataSource } from "../data-source";
import { Query, QueryStatus } from "../entity/Query.entity";
import { checkAdmin } from "../utils/checkAdmin";

const queryRepository = AppDataSource.getRepository(Query);

/* ================= USER ROUTES ================= */

// Create a new query (user)
export const createQuery = async (req: Request, res: Response) => {
    try {
        const { firstName, lastName, email, phone, message } = req.body;

        if (!firstName || !lastName || !email || !phone || !message) {
            return res.status(400).json({ message: "All fields are required" });
        }

        const newQuery = queryRepository.create({
            firstName,
            lastName,
            email,
            phone,
            message,
        });

        await queryRepository.save(newQuery);

        return res.status(201).json({
            status: true,
            message: "Thank you, our expert will contact you soon.",
            data: newQuery,
        });
    } catch (error: any) {
        console.error(error);
        return res.status(500).json({ message: "Internal server error", error: error.message });
    }
};

// Get all queries by email (user)
export const getQueryByEmail = async (req: Request, res: Response) => {
    try {
        const { email } = req.params;

        if (!email) return res.status(400).json({ message: "Email is required" });

        const queries = await queryRepository.find({
            where: { email },
            order: { createdAt: "DESC" },
        });

        if (!queries.length)
            return res.status(404).json({ message: "No queries found for this email" });

        return res.status(200).json({ status: true, data: queries });
    } catch (error: any) {
        console.error(error);
        return res.status(500).json({ message: "Internal server error", error: error.message });
    }
};

/* ================= ADMIN ROUTES ================= */

// Get all queries (admin)
export const getAllQueries = async (req: Request, res: Response) => {
    if (!checkAdmin(req, res)) return res.status(403).json({ message: "Unauthorized" });

    try {
        const queries = await queryRepository.find({
            order: { createdAt: "DESC" },
        });

        return res.status(200).json({ status: true, data: queries });
    } catch (error: any) {
        console.error(error);
        return res.status(500).json({ message: "Internal server error", error: error.message });
    }
};

// Get a single query by queryId (admin)
export const getQueryById = async (req: Request, res: Response) => {
    if (!checkAdmin(req, res)) return res.status(403).json({ message: "Unauthorized" });

    try {
        const { queryId } = req.params;
        const query = await queryRepository.findOne({ where: { id: queryId } });

        if (!query) return res.status(404).json({ message: "Query not found" });

        return res.status(200).json({ status: true, data: query });
    } catch (error: any) {
        console.error(error);
        return res.status(500).json({ message: "Internal server error", error: error.message });
    }
};

// Update query status (admin)
export const updateQueryStatus = async (req: Request, res: Response) => {
    if (!checkAdmin(req, res)) return res.status(403).json({ message: "Unauthorized" });

    try {
        const { queryId } = req.params;
        const { status } = req.body;

        if (!Object.values(QueryStatus).includes(status)) {
            return res.status(400).json({ message: "Invalid status value" });
        }

        const query = await queryRepository.findOne({ where: { id: queryId } });
        if (!query) return res.status(404).json({ message: "Query not found" });

        query.status = status;
        await queryRepository.save(query);

        return res.status(200).json({
            message: "Query status updated successfully",
            data: query,
        });
    } catch (error: any) {
        console.error(error);
        return res.status(500).json({ message: "Internal server error", error: error.message });
    }
};

// Permanently delete a query (admin)
export const deleteQuery = async (req: Request, res: Response) => {
    if (!checkAdmin(req, res)) return res.status(403).json({ message: "Unauthorized" });

    try {
        const { queryId } = req.params;
        const query = await queryRepository.findOne({ where: { id: queryId } });

        if (!query) return res.status(404).json({ message: "Query not found" });

        await queryRepository.remove(query);

        return res.status(200).json({ message: "Query permanently deleted" });
    } catch (error: any) {
        console.error(error);
        return res.status(500).json({ message: "Internal server error", error: error.message });
    }
};

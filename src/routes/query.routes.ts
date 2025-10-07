import { Router } from "express";
import {
    createQuery,
    getQueryByEmail,
    getAllQueries,
    deleteQuery,
} from "../controllers/Query.controllers";

const router = Router();

/* ===== USER ROUTES ===== */
router.post("/create-query", createQuery); // Create query
router.get("/:email", getQueryByEmail);

/* ===== ADMIN ROUTES ===== */
router.get("/", getAllQueries); // Get all queries
router.delete("/delete-query/:id", deleteQuery); // Soft delete a query

export default router;

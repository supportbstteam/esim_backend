import { Router } from "express";
import {
    createQuery,
    getQueryByEmail,
    getAllQueries,
    deleteQuery,
} from "../../controllers/Query.controllers";

const router = Router();

/* ===== USER ROUTES ===== 1 */
router.post("/create-query", createQuery); // Create query
router.get("/:email", getQueryByEmail);

export default router;

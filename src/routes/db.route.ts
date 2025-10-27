import express from 'express';
import { AppDataSource } from '../data-source';
import { clearDatabase } from '../controllers/dbController';

const router = express.Router();

// ✅ Debug route to show all loaded entities
router.delete("/", clearDatabase);

export default router;
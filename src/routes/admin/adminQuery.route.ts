import express from 'express'
import { getAllQueries, getQueryById, updateQueryStatus } from '../../controllers/Query.controllers';

const router = express.Router();

router.get("/all-queries",getAllQueries)
router.get("/:queryId",getQueryById);
router.patch("/:queryId/status",updateQueryStatus);
router.delete("/:queryId",updateQueryStatus);

export default router;
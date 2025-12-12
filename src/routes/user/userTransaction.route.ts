import express from 'express'
import { getUserTransactions, handleCODTransaction, handleTransactionStatus, initiateTopUpTransaction, initiateTransaction } from '../../controllers/stripe/CartStrip.controller';
import { auth } from '../../middlewares/auth.handler';

const router = express.Router();

router.post("/stripe/initiate", initiateTransaction);
router.post("/cod/initiate", handleCODTransaction);
router.get("/", getUserTransactions);
router.post("/topup/initiate", initiateTopUpTransaction);

// Update transaction status manually (from frontend)
router.post("/:id/success", handleTransactionStatus);

export default router;
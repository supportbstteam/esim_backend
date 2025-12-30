import express from 'express'
import { createOrderByMobile, getUserTransactions, handleCODTransaction, handleTransactionStatus, initiateTopUpTransaction, initiateTransaction } from '../../controllers/stripe/CartStrip.controller';
import { auth } from '../../middlewares/auth.handler';

const router = express.Router();

router.post("/stripe/initiate", initiateTransaction);
router.post("/cod/initiate", handleCODTransaction);
router.get("/", getUserTransactions);
router.post("/topup/initiate", initiateTopUpTransaction);

// Update transaction status manually (from frontend)
router.post("/:id/success", handleTransactionStatus);

// update transaction order by mobile for paypal and create one
router.post("/:id/status", createOrderByMobile);

export default router;
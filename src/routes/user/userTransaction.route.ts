import express from 'express'
import { getUserTransactions, handleCODTransaction, handleStripeWebhook, handleTransactionStatus, initiateTransaction } from '../../controllers/stripe/CartStrip.controller';
import { auth } from '../../middlewares/auth.handler';

const router = express.Router();

router.post("/stripe/initiate", initiateTransaction);
router.post("/stripe/webhook", handleStripeWebhook);
router.post("/cod/initiate", handleCODTransaction);
router.get("/", getUserTransactions);

// Update transaction status manually (from frontend)
router.post("/:id/success", handleTransactionStatus);


export default router;
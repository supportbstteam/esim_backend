import { Request, Response } from "express";
import { AppDataSource } from "../data-source";
import { Transaction, TransactionStatus } from "../entity/Transactions.entity";
import { verifyPaypalWebhook } from "../utils/verifyPaypalWebhook";

export const paypalWebhook = async (req: Request, res: Response) => {
    try {
        const isValid = await verifyPaypalWebhook({
            transmissionId: req.headers["paypal-transmission-id"] as string,
            transmissionTime: req.headers["paypal-transmission-time"] as string,
            certUrl: req.headers["paypal-cert-url"] as string,
            authAlgo: req.headers["paypal-auth-algo"] as string,
            transmissionSig: req.headers["paypal-transmission-sig"] as string,
            webhookId: process.env.PAYPAL_WEBHOOK_ID!,
            body: req.body,
        });

        if (!isValid) {
            console.error("❌ Invalid PayPal webhook signature");
            return res.status(400).send("Invalid webhook");
        }

        const event = JSON.parse(req.body.toString());
        const eventType = event.event_type;

        console.log("✅ PayPal webhook received:", eventType);

        if (eventType !== "PAYMENT.CAPTURE.COMPLETED") {
            return res.sendStatus(200);
        }

        const paypalOrderId =
            event.resource?.supplementary_data?.related_ids?.order_id ||
            event.resource?.invoice_id ||
            event.resource?.custom_id ||
            event.resource?.id;

        if (!paypalOrderId) {
            console.error("❌ No PayPal identifier found");
            return res.sendStatus(200);
        }

        console.log("🔑 PayPal ID:", paypalOrderId);

        const transactionRepo = AppDataSource.getRepository(Transaction);

        const transaction = await transactionRepo.findOne({
            where: { transactionId: paypalOrderId },
            lock: { mode: "pessimistic_write" },
        });

        if (!transaction) {
            console.warn("⚠️ Transaction not found:", paypalOrderId);
            return res.sendStatus(200);
        }

        if (transaction.source !== "MOBILE") {
            return res.sendStatus(200);
        }

        transaction.status = TransactionStatus.SUCCESS;
        transaction.gatewayResponse = event;

        await transactionRepo.save(transaction);

        console.log("✅ Transaction updated to SUCCESS:", paypalOrderId);

        return res.sendStatus(200);
    } catch (err) {
        console.error("❌ PayPal webhook error:", err);
        return res.sendStatus(500);
    }
};

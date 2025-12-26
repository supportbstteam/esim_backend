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

        const transactionRepo = AppDataSource.getRepository(Transaction);

        // ---- PAYMENT COMPLETED ----
        if (eventType === "PAYMENT.CAPTURE.COMPLETED") {
            const paypalOrderId =
                event.resource.supplementary_data.related_ids.order_id;

            const transaction = await transactionRepo.findOne({
                where: { transactionId: paypalOrderId },
            });

            if (!transaction) {
                console.warn("⚠️ Transaction not found:", paypalOrderId);
                return res.sendStatus(200);
            }

            if (transaction?.source !== "MOBILE") {
                console.warn("⚠️ Transaction not from mobile:", paypalOrderId);
                return res.sendStatus(200);
            }

            if (transaction.status !== TransactionStatus.SUCCESS) {
                transaction.status = TransactionStatus.SUCCESS;
                transaction.gatewayResponse = event;
                await transactionRepo.save(transaction);
            }
        }

        res.sendStatus(200);
    } catch (err) {
        console.error("PayPal webhook error:", err);
        res.sendStatus(500);
    }
};

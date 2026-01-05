import { Request, Response } from "express";
import { AppDataSource } from "../data-source";
import { Transaction, TransactionStatus } from "../entity/Transactions.entity";
import { verifyPaypalWebhook } from "../utils/verifyPaypalWebhook";

export const paypalWebhook = async (req: Request, res: Response) => {
  try {
    // 1️⃣ Verify PayPal webhook signature
    const isValid = await verifyPaypalWebhook({
      transmissionId: req.headers["paypal-transmission-id"] as string,
      transmissionTime: req.headers["paypal-transmission-time"] as string,
      certUrl: req.headers["paypal-cert-url"] as string,
      authAlgo: req.headers["paypal-auth-algo"] as string,
      transmissionSig: req.headers["paypal-transmission-sig"] as string,
      webhookId: process.env.PAYPAL_WEBHOOK_ID!,
      body: req.body, // RAW BODY
    });

    if (!isValid) {
      console.error("❌ Invalid PayPal webhook signature");
      return res.status(400).send("Invalid webhook");
    }

    // 2️⃣ Parse raw body
    const event = JSON.parse(req.body.toString());
    const eventType = event.event_type;

    console.log("✅ PayPal webhook received:", eventType);

    // We only care about successful captures
    if (eventType !== "PAYMENT.CAPTURE.COMPLETED") {
      return res.sendStatus(200);
    }

    // 3️⃣ SAFELY extract PayPal identifier
    const paypalOrderId =
      event.resource?.supplementary_data?.related_ids?.order_id ||
      event.resource?.invoice_id ||
      event.resource?.custom_id;

    if (!paypalOrderId) {
      console.error("❌ PayPal ID not found in webhook", event.resource);
      return res.sendStatus(200);
    }

    console.log("🔑 PayPal Order ID:", paypalOrderId);

    // 4️⃣ Fetch transaction
    const transactionRepo = AppDataSource.getRepository(Transaction);

    const transaction = await transactionRepo.findOne({
      where: { transactionId: paypalOrderId },
    });

    if (!transaction) {
      console.warn("⚠️ Transaction not found:", paypalOrderId);
      return res.sendStatus(200);
    }

    if (transaction.source !== "MOBILE") {
      console.warn("⚠️ Transaction not from mobile:", paypalOrderId);
      return res.sendStatus(200);
    }

    // 5️⃣ Idempotency guard
    if (transaction.status === TransactionStatus.SUCCESS) {
      console.log("ℹ️ Transaction already SUCCESS:", paypalOrderId);
      return res.sendStatus(200);
    }

    // 6️⃣ Update payment state (LEDGER ONLY)
    transaction.status = TransactionStatus.SUCCESS;
    transaction.gatewayResponse = event;

    await transactionRepo.save(transaction);

    console.log("✅ Transaction marked SUCCESS:", paypalOrderId);

    return res.sendStatus(200);
  } catch (err) {
    console.error("❌ PayPal webhook error:", err);
    return res.sendStatus(500);
  }
};
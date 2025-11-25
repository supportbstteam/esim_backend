import { Request, Response } from "express";
import Stripe from "stripe";
import { AppDataSource } from "../../data-source";
import { User } from "../../entity/User.entity";
import { Cart } from "../../entity/Carts.entity";
import { Transaction, TransactionStatus } from "../../entity/Transactions.entity";
import { createOrderAfterPayment } from "../../utils/createOrderAfterPayment";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
    apiVersion: "2025-09-30.clover" as any,
});

/**
 * ✅ 1️⃣ Create PaymentIntent for Mobile
 */
export const initiateMobileTransaction = async (req: any, res: Response) => {
    const userId = req.user?.id;
    console.log("📱 initiateMobileTransaction started for:", userId);

    try {
        const userRepo = AppDataSource.getRepository(User);
        const cartRepo = AppDataSource.getRepository(Cart);
        const transactionRepo = AppDataSource.getRepository(Transaction);

        const user = await userRepo.findOne({ where: { id: userId } });
        if (!user) return res.status(404).json({ message: "User not found" });

        const cart = await cartRepo.findOne({
            where: { user: { id: userId }, isCheckedOut: false, isDeleted: false },
            relations: ["items", "items.plan"],
        });

        if (!cart || cart.items.length === 0)
            return res.status(404).json({ message: "Cart empty" });

        const amount = cart.items.reduce((total, item) => {
            const price = Number(item.plan?.price ?? 0);
            const qty = Number(item.quantity ?? 0);
            return total + price * qty;
        }, 0);

        // 🟢 Create PaymentIntent
        const paymentIntent = await stripe.paymentIntents.create({
            amount: Math.round(amount * 100),
            currency: "usd",
            metadata: {
                userId: user.id,
                cartId: cart.id,
                source: "mobile",
            },
            automatic_payment_methods: { enabled: true },
        });

        // 🟢 Save Transaction
        const transaction = new Transaction();
        transaction.user = user;
        transaction.cart = cart;
        transaction.transactionId = paymentIntent.id;
        transaction.paymentGateway = "stripe";
        transaction.amount = amount;
        transaction.status = "PENDING";
        transaction.source = "MOBILE";
        await transactionRepo.save(transaction);

        return res.status(201).json({
            message: "Mobile transaction created successfully",
            clientSecret: paymentIntent.client_secret,
            transaction,
        });
    } catch (err: any) {
        console.error("❌ initiateMobileTransaction error:", err);
        return res.status(500).json({ message: "Internal server error", error: err.message });
    }
};

/**
 * ✅ 2️⃣ Handle Mobile Stripe Webhook + Create Order
 */
export const handleMobileStripeWebhook = async (req: Request, res: Response) => {
    console.log("-=-=-=-=-=- hello mobile-hook calling -=-=-=-=-=")
    console.log("🚀 [WEBHOOK] Mobile Stripe webhook received");

    const sig = req.headers["stripe-signature"];
    const endpointSecret = process.env.STRIPE_MOBILE_WEBHOOK_SECRET || "";

    if (!sig) {
        console.error("❌ [WEBHOOK] Missing Stripe signature header");
        return res.status(400).send("Missing Stripe signature");
    }

    console.log("🧩 [WEBHOOK] Signature header found:", sig.slice(0, 20) + "...");

    let event: Stripe.Event;

    // 🔹 Step 1: Verify the webhook signature
    try {
        console.log("🔐 [WEBHOOK] Verifying webhook signature...");
        event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
        console.log("✅ [WEBHOOK] Stripe event verified successfully:", event.type);
    } catch (err: any) {
        console.error("❌ [WEBHOOK] Signature verification failed:", err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    const transactionRepo = AppDataSource.getRepository(Transaction);
    const cartRepo = AppDataSource.getRepository(Cart);

    try {
        // 🔹 Step 2: Log incoming event
        console.log("📩 [WEBHOOK] Received Stripe event:", event.type);

        // 🔹 Step 3: Handle successful payment
        if (event.type === "payment_intent.succeeded") {
            console.log("💰 [WEBHOOK] Payment succeeded — processing order creation...");

            const paymentIntent = event.data.object as Stripe.PaymentIntent;
            console.log("🆔 [WEBHOOK] PaymentIntent ID:", paymentIntent.id);
            console.log("💵 [WEBHOOK] Amount received (cents):", paymentIntent.amount);
            console.log("📦 [WEBHOOK] Metadata:", paymentIntent.metadata);

            // 🔹 Step 4: Fetch transaction
            console.log("🔍 [WEBHOOK] Searching for matching transaction...");
            const transaction = await transactionRepo.findOne({
                where: { transactionId: paymentIntent.id },
                relations: ["user", "cart", "cart.items", "cart.items.plan", "cart.items.plan.country"],
            });

            if (!transaction) {
                console.error("❌ [WEBHOOK] No transaction found for PaymentIntent:", paymentIntent.id);
                return res.status(404).send("Transaction not found");
            }

            console.log("✅ [WEBHOOK] Transaction found:", transaction.id);
            console.log("👤 [WEBHOOK] User:", transaction.user?.email);
            console.log("🛒 [WEBHOOK] Cart ID:", transaction.cart?.id);

            // 🔹 Step 5: Mark transaction success
            transaction.status = TransactionStatus.SUCCESS;
            transaction.response = JSON.stringify(paymentIntent);
            await transactionRepo.save(transaction);
            console.log("✅ [WEBHOOK] Transaction status updated to SUCCESS");

            // 🔹 Step 6: Create the order
            console.log("🧩 [WEBHOOK] Creating order from transaction...");
            await createOrderAfterPayment(transaction, transaction.user?.id || "");
            console.log("🎉 [WEBHOOK] Order successfully created for mobile transaction");

            // 🔹 Step 7: Mark cart checked out
            if (!transaction?.cart) {
                console.error("❌ [WEBHOOK] No cart found in transaction");
                return res.status(404).json({ message: "Cart not found" });
            }

            transaction.cart.isCheckedOut = true;
            await cartRepo.save(transaction.cart);
            console.log("🛒 [WEBHOOK] Cart marked as checked out");

            console.log("✅ [WEBHOOK] Mobile webhook handling complete");
            return res.status(200).json({ received: true });
        }

        // 🔹 Step 8: Handle payment failures
        if (event.type === "payment_intent.payment_failed") {
            console.warn("⚠️ [WEBHOOK] Payment failed");
            const paymentIntent = event.data.object as Stripe.PaymentIntent;

            const transaction = await transactionRepo.findOne({
                where: { transactionId: paymentIntent.id },
            });

            if (transaction) {
                transaction.status = TransactionStatus.FAILED;
                transaction.response = JSON.stringify(paymentIntent);
                await transactionRepo.save(transaction);
                console.log("⚠️ [WEBHOOK] Transaction marked FAILED in database");
            } else {
                console.log("⚠️ [WEBHOOK] No transaction found for failed payment");
            }
        }

        // 🔹 Step 9: Unknown event types
        console.log("ℹ️ [WEBHOOK] Ignoring event type:", event.type);
        res.json({ received: true });

    } catch (err: any) {
        console.error("💥 [WEBHOOK] Internal processing error:", err.message);
        console.error(err.stack);
        return res.status(500).json({ message: "Internal server error", error: err.message });
    }
};

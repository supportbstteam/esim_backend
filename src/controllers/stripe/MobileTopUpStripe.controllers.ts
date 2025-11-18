import { Response } from 'express'
import { AppDataSource } from '../../data-source';
import { User } from '../../entity/User.entity';
import { Esim } from '../../entity/Esim.entity';
import { TopUpPlan } from '../../entity/Topup.entity';
import { Transaction, TransactionStatus } from '../../entity/Transactions.entity';
import Stripe from "stripe";
import { EsimTopUp } from '../../entity/EsimTopUp.entity';
import { Order, OrderType } from '../../entity/order.entity';


const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
    apiVersion: "2025-09-30.clover" as any,
});

export const initiateMobileTopUpTransaction = async (req: any, res: Response) => {

    console.log("-=-=--=-=-=-=-= in the initiate mobile top up transaction -=--=-=--=-=-=-=-=-",req.body)
    const userId = req.user?.id;
    const { topupId, esimId } = req.body;

    console.log("📱 initiateMobileTopUpTransaction started for:", userId);

    if (!userId || !topupId || !esimId) {
        return res.status(400).json({ message: "Missing required fields" });
    }

    try {
        const userRepo = AppDataSource.getRepository(User);
        const esimRepo = AppDataSource.getRepository(Esim);
        const topupRepo = AppDataSource.getRepository(TopUpPlan);
        const transactionRepo = AppDataSource.getRepository(Transaction);

        const user = await userRepo.findOne({ where: { id: userId } });
        if (!user) return res.status(404).json({ message: "User not found" });

        const esim = await esimRepo.findOne({
            where: { id: esimId, user: { id: userId } },
            relations: ["country"],
        });
        if (!esim) return res.status(404).json({ message: "eSIM not found" });

        const topUp = await topupRepo.findOne({
            where: { id: topupId, isActive: true, isDeleted: false },
            relations: ["country"],
        });
        if (!topUp) return res.status(404).json({ message: "Top-up plan not found" });

        const amount = Number(topUp.price || 0);

        // Create PaymentIntent
        const paymentIntent = await stripe.paymentIntents.create({
            amount: Math.round(amount * 100),
            currency: (topUp.currency || "USD").toLowerCase(),
            metadata: {
                userId: user.id,
                topupId,
                esimId,
                source: "mobile_topup",
            },
        });

        const transaction = transactionRepo.create({
            user,
            topupPlan: topUp,
            esim,
            transactionId: paymentIntent.id,
            paymentGateway: "stripe",
            amount,
            status: TransactionStatus.PENDING,
            source: "MOBILE",
        });

        await transactionRepo.save(transaction);

        return res.status(201).json({
            message: "Mobile top-up transaction created",
            clientSecret: paymentIntent.client_secret,
            transaction,
        });

    } catch (err: any) {
        console.error("❌ initiateMobileTopUpTransaction error:", err);
        return res.status(500).json({ message: "Internal server error", error: err.message });
    }
};


export const handleMobileTopUpStripeWebhook = async (req: any, res: Response) => {
    console.log("🚀 [WEBHOOK] Mobile TopUp Stripe webhook received");

    const sig = req.headers["stripe-signature"];
    const endpointSecret = process.env.STRIPE_MOBILE_TOPUP_WEBHOOK_SECRET || "";

    if (!sig) {
        console.error("❌ Missing Stripe signature");
        return res.status(400).send("Missing Stripe signature");
    }

    let event: Stripe.Event;

    try {
        event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
        console.log("✅ Webhook verified:", event.type);
    } catch (err: any) {
        console.error("❌ Signature verification failed:", err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    const transactionRepo = AppDataSource.getRepository(Transaction);
    const esimRepo = AppDataSource.getRepository(Esim);
    const esimTopUpRepo = AppDataSource.getRepository(EsimTopUp);
    const orderRepo = AppDataSource.getRepository(Order);

    try {
        if (event.type !== "payment_intent.succeeded") {
            return res.status(200).json({ received: true });
        }

        const paymentIntent = event.data.object as Stripe.PaymentIntent;

        const transaction = await transactionRepo.findOne({
            where: { transactionId: paymentIntent.id },
            relations: ["user", "topupPlan", "esim", "esim.country"],
        });

        if (!transaction) {
            console.error("❌ No transaction for:", paymentIntent.id);
            return res.status(404).send("Transaction not found");
        }

        const user = transaction.user;
        const topUp = transaction.topupPlan;
        const esim = transaction.esim;

        // MARK TRANSACTION SUCCESS
        transaction.status = TransactionStatus.SUCCESS;
        transaction.response = JSON.stringify(paymentIntent);
        await transactionRepo.save(transaction);

        // APPLY TOP UP TO ESIM
        esim.dataAmount = (esim.dataAmount || 0) + (topUp?.dataLimit || 0);
        esim.validityDays = Math.max(esim.validityDays || 0, topUp?.validityDays || 0);
        await esimRepo.save(esim);

        // CREATE ORDER
        const order = orderRepo.create({
            user,
            transaction,
            country: esim.country,
            totalAmount: transaction.amount,
            status: "COMPLETED",
            email: user?.email,
            name: `${user?.firstName || ""} ${user?.lastName || ""}`.trim(),
            phone: user?.phone,
            activated: true,
            type: OrderType.TOP_UP,
        });

        await orderRepo.save(order);

        // CREATE ESIM TOPUP ENTRY
        const esimTopUp = esimTopUpRepo.create({
            esim,
            topup: topUp,
            order,
        });

        await esimTopUpRepo.save(esimTopUp);

        console.log("🎉 Top-up order created successfully");
        return res.status(200).json({ received: true });

    } catch (err: any) {
        console.error("💥 Webhook error:", err.message);
        return res.status(500).json({ message: "Internal server error", error: err.message });
    }
};


// GET /user/top-up/status/:transactionId
export const getTopUpStatus = async (req: any, res: Response) => {
    const { transactionId } = req.params;

    console.log("----- TopUp transaction id ----", transactionId);

    const transactionRepo = AppDataSource.getRepository(Transaction);
    const esimTopUpRepo = AppDataSource.getRepository(EsimTopUp);

    // 🔍 Fetch transaction
    const transaction = await transactionRepo.findOne({
        where: { id: transactionId },
        relations: ["topupPlan", "esim"],
    });

    if (!transaction) {
        return res.status(404).json({ message: "Transaction not found" });
    }

    if (transaction.source !== "MOBILE") {
        return res.status(400).json({ message: "Invalid transaction type" });
    }

    // Still pending?
    if (transaction.status === TransactionStatus.PENDING) {
        return res.json({
            status: "PENDING",
            message: "Payment still pending",
        });
    }

    // Failed?
    if (transaction.status === TransactionStatus.FAILED) {
        return res.json({
            status: "FAILED",
            message: "Payment failed",
        });
    }

    // Success → Fetch EsimTopUp entry
    const topUpRecord = await esimTopUpRepo.findOne({
        where: {
            esim: { id: transaction.esim?.id },
            topup: { id: transaction.topupPlan?.id },
        },
        relations: ["esim", "topup"],
    });

    if (!topUpRecord) {
        return res.status(404).json({
            status: "SUCCESS",
            message: "Payment success but top-up not applied yet",
        });
    }

    // 🎉 Top-up fully applied
    return res.json({
        status: "SUCCESS",
        topUpApplied: true,
        esimId: transaction.esim?.id,
        topupId: transaction.topupPlan?.id,
        dataAdded: transaction.topupPlan?.dataLimit || 0,
        validityAdded: transaction.topupPlan?.validityDays || 0,
    });
};

export const initiateCODTopUpTransaction = async (req: any, res: Response) => {
    const userId = req.user?.id;
    const { topupId, esimId } = req.body;

    if (!userId || !topupId || !esimId) {
        return res.status(400).json({ message: "Missing required fields" });
    }

    try {
        const userRepo = AppDataSource.getRepository(User);
        const esimRepo = AppDataSource.getRepository(Esim);
        const topUpRepo = AppDataSource.getRepository(TopUpPlan);
        const transactionRepo = AppDataSource.getRepository(Transaction);
        const orderRepo = AppDataSource.getRepository(Order);

        const user = await userRepo.findOne({ where: { id: userId } });
        if (!user) return res.status(404).json({ message: "User not found" });

        const esim = await esimRepo.findOne({
            where: { id: esimId, user: { id: userId } },
            relations: ["country"],
        });
        if (!esim) return res.status(404).json({ message: "eSIM not found" });

        const topUp = await topUpRepo.findOne({
            where: { id: topupId, isActive: true, isDeleted: false },
            relations: ["country"],
        });
        if (!topUp) return res.status(404).json({ message: "Top-up plan not found" });

        const amount = Number(topUp.price || 0);

        // 1️⃣ CREATE TRANSACTION (PENDING COD)
        const transaction = transactionRepo.create({
            user,
            topupPlan: topUp,
            esim,
            paymentGateway: "COD",
            amount,
            status: TransactionStatus.PENDING,
            source: "MOBILE",
        });

        await transactionRepo.save(transaction);

        // 2️⃣ CREATE ORDER (NOT COMPLETED)
        const order = orderRepo.create({
            user,
            transaction,
            country: esim.country,
            totalAmount: amount,
            status: "PENDING",
            email: user.email,
            name: `${user.firstName || ""} ${user.lastName || ""}`.trim(),
            phone: user.phone,
            activated: false,
            type: OrderType.TOP_UP,
        });

        await orderRepo.save(order);

        return res.status(201).json({
            message: "COD top-up transaction created",
            transactionId: transaction.id,
            orderId: order.id,
            payableAmount: amount,
        });

    } catch (err: any) {
        console.error("❌ initiateCODTopUpTransaction error:", err);
        return res.status(500).json({ message: "Internal server error", error: err.message });
    }
};

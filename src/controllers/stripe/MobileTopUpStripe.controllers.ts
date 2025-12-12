import { Response } from 'express'
import { AppDataSource } from '../../data-source';
import { User } from '../../entity/User.entity';
import { Esim } from '../../entity/Esim.entity';
import { TopUpPlan } from '../../entity/Topup.entity';
import { Transaction, TransactionStatus } from '../../entity/Transactions.entity';
import Stripe from "stripe";
import { EsimTopUp } from '../../entity/EsimTopUp.entity';
import { Order, ORDER_STATUS, OrderType } from '../../entity/order.entity';
import { v4 as uuid } from "uuid";
import { sendAdminOrderNotification, sendTopUpUserNotification } from '../../utils/email';
import axios from 'axios';
import { getValidThirdPartyToken } from '../../middlewares/tokenTruism.service';
import { sendUserNotification } from '../../utils/userNotification';
const FormData = require("form-data");


const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
    apiVersion: "2025-09-30.clover" as any,
});


const failTopUpWebhook = async (
    order: Order,
    transaction: Transaction,
    esimTopUpRepo: any,
    esim: Esim,
    topUp: TopUpPlan,
    errorMessage: string
) => {

    const orderRepo = AppDataSource.getRepository(Order);
    const transactionRepo = AppDataSource.getRepository(Transaction);

    transaction.status = TransactionStatus.FAILED;
    await transactionRepo.save(transaction);

    order.status = "FAILED";
    order.errorMessage = errorMessage;
    await orderRepo.save(order);

    const failed = esimTopUpRepo.create({ esim, topup: topUp, order });
    await esimTopUpRepo.save(failed);

    try {
        await sendAdminOrderNotification(order);
        await sendTopUpUserNotification(order);
    } catch (err: any) {
        console.error("📧 Email failed:", err.message);
    }
};



export const initiateMobileTopUpTransaction = async (req: any, res: Response) => {

    // console.log("-=-=--=-=-=-=-= in the initiate mobile top up transaction -=--=-=--=-=-=-=-=-", req.body)
    const userId = req.user?.id;
    const { topupId, esimId } = req.body;

    // console.log("📱 initiateMobileTopUpTransaction started for:", userId);

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

        const customer = await stripe.customers.create({
            name: (user?.firstName + user?.lastName).toString() || "N/A",
            email: user?.email || "N/A",
            phone: user?.phone || "N/A", // make sure this field exists in your DB
        });

        // Create PaymentIntent
        const paymentIntent = await stripe.paymentIntents.create({
            amount: Math.round(amount * 100),
            customer: customer?.id,
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
    console.log("🚀 [WEBHOOK] Mobile Top-Up Webhook Hit");

    const sig = req.headers["stripe-signature"];
    // const endpointSecret =  "whsec_24bd7ce3b2fa8fab6a5e647d12eb2df6ad1b95619f7ed7ca96c42d1d3c2ae4f0";
    const endpointSecret = process.env.STRIPE_MOBILE_TOPUP_WEBHOOK_SECRET || "";

    if (!sig) return res.status(400).send("Missing Stripe signature");

    let event: Stripe.Event;
    try {
        event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
        console.log("✅ Stripe signature verified:", event.type);
    } catch (err: any) {
        console.error("❌ Signature verification failed:", err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type !== "payment_intent.succeeded") {
        return res.status(200).json({ received: true });
    }

    const paymentIntent = event.data.object as Stripe.PaymentIntent;

    const transactionRepo = AppDataSource.getRepository(Transaction);
    const esimRepo = AppDataSource.getRepository(Esim);
    const topUpRepo = AppDataSource.getRepository(TopUpPlan);
    const orderRepo = AppDataSource.getRepository(Order);
    const esimTopUpRepo = AppDataSource.getRepository(EsimTopUp);

    try {
        console.log("🔍 Looking up transaction:", paymentIntent.id);

        const transaction = await transactionRepo.findOne({
            where: { transactionId: paymentIntent.id },
            relations: ["user", "topupPlan", "esim", "esim.country", "esim.plans"],
        });

        if (!transaction) return res.status(404).json({ received: true });
        if (transaction.source !== "MOBILE") return res.status(200).json({ received: true });

        const user = transaction.user;
        const topUp = transaction.topupPlan;
        const esim = transaction.esim;

        if (!esim) {
            console.warn("⚠️ No eSIM linked to top-up transaction:", transaction.id);
            return res.status(200).json({ received: true });
        }

        if (!esim.plans || esim.plans.length === 0) {
            console.warn("⚠️ eSIM has no linked plans:", esim.id);
            return res.status(200).json({ received: true });
        }

        if (!user) {
            return res.status(400).json({ message: "User not found" });
        }

        const planId = esim.plans[0]?.id;

        // -----------------------------
        // STEP 1 — Mark Transaction Success
        // -----------------------------
        transaction.status = TransactionStatus.SUCCESS;
        transaction.response = JSON.stringify(paymentIntent);
        await transactionRepo.save(transaction);

        // -----------------------------
        // STEP 2 — Idempotent Order Creation
        // -----------------------------
        let order = await orderRepo.findOne({
            where: { transaction: { id: transaction.id } }
        });

        if (!order) {
            order = orderRepo.create({
                user,
                transaction,
                country: esim.country,
                totalAmount: transaction.amount,
                status: "PENDING",
                name: `${user?.firstName || ""} ${user?.lastName || ""}`.trim(),
                email: user?.email,
                phone: user?.phone,
                activated: false,
                type: OrderType.TOP_UP,
            });

            await orderRepo.save(order);
        }

        // -----------------------------
        // STEP 3 — FETCH VALID PROVIDER TOKEN
        // -----------------------------
        console.log("🔑 Fetching valid Turisim token...");
        const token = await getValidThirdPartyToken();  // ⭐ SAME AS createOrderAfterPayment()
        const headers = {
            Authorization: `Bearer ${token}`,
            "Content-Type": "multipart/form-data"
        };

        // -----------------------------
        // STEP 4 — Call Provider API for Top-Up
        // -----------------------------
        const formdata = new FormData();
        formdata.append("product_plan_id", topUp?.topupId);
        formdata.append("product_id", planId);
        formdata.append("iccid", esim.iccid);

        let response;
        try {
            console.log("📡 Calling provider top-up API...");
            response = await axios.post(
                `${process.env.TURISM_URL}/v2/sims/${esim.iccid}/topup`,
                formdata,
                { headers }
            );

            console.log("-=-=-=--=- response in the top up order -=-=-=-=-=-=", response);
        } catch (err: any) {
            console.error("❌ Provider API error:", err.message);

            if (topUp)
                await failTopUpWebhook(order, transaction, esimTopUpRepo, esim, topUp, err.message);

            return res.status(200).json({ received: true });
        }

        // -----------------------------
        // STEP 5 — PROVIDER SUCCESS
        // -----------------------------
        if (response.data?.status === "success") {

            order.status = "COMPLETED";
            order.activated = true;
            await orderRepo.save(order);

            esim.dataAmount = topUp?.dataLimit ? (esim.dataAmount || 0) + topUp?.dataLimit : (esim.dataAmount || 0);
            esim.validityDays = topUp?.validityDays ? (Math.max(esim.validityDays || 0, topUp?.validityDays)) : (Math.max(esim.validityDays || 0, topUp?.validityDays || 0));
            await esimRepo.save(esim);

            const topupSave = esimTopUpRepo.create({ esim, topup: topUp, order });
            await esimTopUpRepo.save(topupSave);

            try {
                await sendUserNotification({
                    userId: user.id,
                    code: "TOPUP_SUCCESS",
                    data: {
                        country: esim.country,
                        dataAmount: `${topUp?.dataLimit || 0}MB`,
                        orderId: order?.id
                    },
                });
            } catch (notifyErr: any) {
                console.error("⚠️ Top-up success notification failed:", notifyErr.message);
            }

            try {
                await sendAdminOrderNotification(order);
                await sendTopUpUserNotification(order);


            } catch (mailErr: any) {
                console.error("📧 Email failed:", mailErr.message);
            }

            return res.status(200).json({ received: true });
        }

        // -----------------------------
        // STEP 6 — PROVIDER FAILURE
        // -----------------------------
        if (topUp) {

            await failTopUpWebhook(
                order,
                transaction,
                esimTopUpRepo,
                esim,
                topUp,
                response.data?.message || "Top-up failed"
            );

            try {
                await sendUserNotification({
                    userId: user.id,
                    code: "TOPUP_FAILED",
                    data: {
                        country: esim.country,
                        orderId: order?.id
                    },
                });
            } catch (notifyErr: any) {
                console.error("⚠️ Top-up failure notification failed:", notifyErr.message);
            }

        }

        return res.status(200).json({ received: true });

    } catch (err: any) {
        console.error("💥 Webhook handler crashed:", err);
        return res.status(200).json({ received: true });
    }
};


// GET /user/top-up/status/:transactionId
export const getTopUpStatus = async (req: any, res: Response) => {
    const { transactionId } = req.params;

    // console.log("----- TopUp transaction id ----", transactionId);

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
    // console.log("➡️ [COD-TOPUP] Request received:", req.body);

    const userId = req.user?.id;
    const { topupId, esimId } = req.body;

    // console.log("🔍 User ID:", userId);
    // console.log("🔍 TopUp ID:", topupId);
    // console.log("🔍 eSIM ID:", esimId);

    if (!userId || !topupId || !esimId) {
        // console.log("❌ Missing fields");
        return res.status(400).json({ message: "topupId and esimId are required" });
    }

    try {
        // Repos
        const userRepo = AppDataSource.getRepository(User);
        const esimRepo = AppDataSource.getRepository(Esim);
        const topUpRepo = AppDataSource.getRepository(TopUpPlan);
        const transactionRepo = AppDataSource.getRepository(Transaction);
        const orderRepo = AppDataSource.getRepository(Order);
        const esimTopUpRepo = AppDataSource.getRepository(EsimTopUp);

        // 1️⃣ Validate user
        // console.log("📦 Fetching user...");
        const user = await userRepo.findOne({ where: { id: userId } });
        if (!user) return res.status(404).json({ message: "User not found" });

        // 2️⃣ Validate eSIM
        // console.log("📦 Fetching eSIM...");
        const esim = await esimRepo.findOne({
            where: { id: esimId, user: { id: userId } },
            relations: ["country", "plans"],
        });
        if (!esim) return res.status(404).json({ message: "eSIM not found" });

        if (!esim.plans?.length) {
            return res.status(400).json({ message: "eSIM has no base plan to top-up" });
        }

        const basePlanId = esim.plans[0].id;

        // 3️⃣ Validate top-up plan
        // console.log("📦 Fetching TopUp plan...");
        const topUp = await topUpRepo.findOne({
            where: { id: topupId, isActive: true, isDeleted: false }
        });
        if (!topUp) return res.status(404).json({ message: "Top-up plan not found" });

        const amount = Number(topUp.price || 0);
        // console.log("💰 Amount:", amount);

        // 4️⃣ Create COD transaction
        // console.log("🧾 Creating COD transaction...");
        const transaction = transactionRepo.create({
            user,
            esim,
            topupPlan: topUp,
            paymentGateway: "COD",
            transactionId: uuid(),
            amount,
            status: TransactionStatus.SUCCESS, // COD auto-success
            source: "MOBILE",
        });

        await transactionRepo.save(transaction);
        // console.log("✅ Transaction created:", transaction.id);

        // 5️⃣ Create order
        // console.log("🧾 Creating order...");
        const order = orderRepo.create({
            user,
            transaction,
            country: esim.country,
            totalAmount: amount,
            status: ORDER_STATUS.PROCESSING,
            email: user.email,
            name: `${user.firstName || ""} ${user.lastName || ""}`.trim(),
            phone: user.phone,
            activated: false,
            type: OrderType.TOP_UP,
        });

        await orderRepo.save(order);
        // console.log("✅ Order created:", order.id);

        // 6️⃣ Send Top-Up request to API
        // console.log("📡 Calling TopUp API...");

        const formdata = new FormData();
        formdata.append("product_plan_id", String(topUp.topupId || ""));
        formdata.append("product_id", String(basePlanId || ""));
        formdata.append("iccid", String(esim.iccid || ""));

        const headers = {
            Authorization: `Bearer ${req.thirdPartyToken}`,
            ...formdata.getHeaders(), // <-- FIXED TS ERROR
        };


        const response = await axios.post(
            `${process.env.TURISM_URL}/v2/sims/${esim.iccid}/topup`,
            formdata,
            { headers }
        );

        // console.log("📡 TopUp API Response:", response.data);

        // 7️⃣ Success case
        if (response.data?.status === "success") {
            // console.log("✅ TopUp success — updating DB");

            transaction.status = "SUCCESS";
            await transactionRepo.save(transaction);

            order.status = ORDER_STATUS.COMPLETED;
            order.activated = true;
            await orderRepo.save(order);

            const topUpEntry = esimTopUpRepo.create({
                esim,
                topup: topUp,
                order,
            });

            await esimTopUpRepo.save(topUpEntry);

            await sendAdminOrderNotification(order);
            await sendTopUpUserNotification(order);

            return res.status(200).json({
                status: true,
                message: "Top-up successful",
                transaction,
                order,
                providerResponse: response.data,
            });
        }

        // 8️⃣ Failure case
        // console.log("❌ TopUp failed — rolling back");

        transaction.status = "FAILED";
        await transactionRepo.save(transaction);

        order.status = ORDER_STATUS.FAILED;
        order.errorMessage = response.data?.message || "Top-up failed";
        await orderRepo.save(order);

        const failedEntry = esimTopUpRepo.create({
            esim,
            topup: topUp,
            order,
        });
        await esimTopUpRepo.save(failedEntry);

        await sendAdminOrderNotification(order);
        await sendTopUpUserNotification(order);

        return res.status(400).json({
            status: false,
            message: "Top-up failed",
            providerResponse: response.data,
        });

    } catch (err: any) {
        console.error("🔥 [COD-TOPUP] Error:", err);

        return res.status(500).json({
            status: false,
            message: "Internal Server Error",
            error: err.message,
        });
    }
};
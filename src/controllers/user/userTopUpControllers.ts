import { Response } from "express";
import { CartItem } from "../../entity/CartItem.entity";
import { Cart } from "../../entity/Carts.entity";
import { TopUpPlan } from "../../entity/Topup.entity";
import { AppDataSource } from "../../data-source";
import { Esim } from "../../entity/Esim.entity";
import { Transaction } from "../../entity/Transactions.entity";
import { User } from "../../entity/User.entity";
import axios from "axios";
import { Order, OrderType } from "../../entity/order.entity";

export const postUserTopUpOrder = async (req: any, res: Response) => {
    const { id } = req.user || {}; // ✅ fixed destructuring bug
    const { topupId, transactionId, esimId } = req.body;

    console.log("POST /topup - payload:", { topupId, transactionId, esimId, userId: id });

    if (!id) {
        console.log("Unauthorized: missing user id");
        return res.status(401).json({ status: false, message: "Unauthorized" });
    }

    if (!topupId || !transactionId || !esimId) {
        console.log("Bad request: missing required fields");
        return res.status(400).json({
            status: false,
            message: "topupId, transactionId and esimId are required"
        });
    }

    try {
        const userRepo = AppDataSource.getRepository(User);
        const esimRepo = AppDataSource.getRepository(Esim);
        const topUpRepo = AppDataSource.getRepository(TopUpPlan);
        const transactionRepo = AppDataSource.getRepository(Transaction);
        const orderRepo = AppDataSource.getRepository(Order); // ✅ added

        const user = await userRepo.findOne({ where: { id } });
        console.log("Fetched user:", !!user, user ? { id: user.id, email: user.email } : null);

        const topUp = await topUpRepo.findOne({ where: { id: topupId } });
        console.log("Fetched topUp plan:", !!topUp, topUp ? { id: topUp.id, topupId: topUp.topupId } : null);

        const esim = await esimRepo.findOne({
            where: { id: esimId },
            relations: ["country", "plans"], // ensure plans relation loaded
        });
        console.log("Fetched esim:", !!esim, esim ? { id: esim.id, iccid: esim.iccid, plansLength: Array.isArray(esim.plans) ? esim.plans.length : 0 } : null);

        const transaction = await transactionRepo.findOne({ where: { id: transactionId } });
        console.log("Fetched transaction:", !!transaction, transaction ? { id: transaction.id, status: transaction.status, amount: transaction.amount } : null);

        if (!user) {
            console.error("User not found for id:", id);
            return res.status(404).json({ status: false, message: "User not found" });
        }
        if (!topUp) {
            console.error("Top-up plan not found for id:", topupId);
            return res.status(404).json({ status: false, message: "Top-up plan not found" });
        }
        if (!esim) {
            console.error("eSIM not found for id:", esimId);
            return res.status(404).json({ status: false, message: "eSIM not found" });
        }
        if (!transaction) {
            console.error("Transaction not found for id:", transactionId);
            return res.status(404).json({ status: false, message: "Transaction not found" });
        }

        // Defensive check: ensure esim.plans exists and has at least one plan
        if (!Array.isArray(esim.plans) || esim.plans.length === 0) {
            console.error("eSIM has no associated plans:", { esimId, plans: esim.plans });
            // Mark transaction/order failed if transaction exists
            transaction.status = "FAILED";
            await transactionRepo.save(transaction);

            return res.status(400).json({
                status: false,
                message: "eSIM has no associated plan to top-up",
            });
        }

        const planId = esim.plans[0]?.id;
        console.log("Using planId from esim.plans[0]:", planId);

        const existingOrder = await orderRepo.findOne({
            where: { transaction: { id: transactionId } },
        });

        if (existingOrder) {
            return res.status(400).json({
                status: false,
                message: `Order already exists for this transaction (Order ID: ${existingOrder.id})`,
            });
        }

        // ✅ Create a new order in 'PENDING' state
        const order = orderRepo.create({
            user,
            transaction,
            country: esim.country,
            totalAmount: Number(transaction?.amount || 0),
            status: "PENDING",
            name: `${user?.firstName || ""} ${user?.lastName || ""}`.trim(),
            email: user.email,
            activated: false,
            type :OrderType.TOP_UP
        });

        await orderRepo.save(order);
        console.log("Created order (PENDING):", { orderId: order.id });

        console.log("------Initiating top-up  id-------", topUp.topupId);

        // ✅ Prepare request to third-party API
        const formdata: any = new FormData();
        formdata.append("product_plan_id", topUp.topupId); // top up id
        formdata.append("product_id", planId); // plan id
        formdata.append("iccid", esim.iccid);

        console.log("Form data prepared:", { product_plan_id: topUp.topupId, product_id: planId, iccid: esim.iccid });

        const response = await axios.post(
            `${process.env.TURISM_URL}/v2/sims/${esim.iccid}/topup`,
            formdata,
            {
                headers: {
                    Authorization: `Bearer ${req?.thirdPartyToken}`,
                    "Content-Type": "multipart/form-data"
                }
            }
        );

        console.log("------Top-up response -------", response?.data);

        if (response.data?.status === "success") {
            // ✅ Update transaction + order on success
            transaction.status = "SUCCESS";
            await transactionRepo.save(transaction);
            console.log("Transaction marked SUCCESS:", transaction.id);

            order.status = "COMPLETED";
            order.activated = true;
            await orderRepo.save(order);
            console.log("Order marked COMPLETED and activated:", order.id);

            return res.status(200).json({
                status: true,
                message: "Top-up successful",
                data: response.data
            });
        } else {
            // ❌ Top-up failed — record the failure
            console.warn("Top-up API returned failure:", response?.data);

            transaction.status = "FAILED";
            await transactionRepo.save(transaction);
            console.log("Transaction marked FAILED:", transaction.id);

            order.status = "FAILED";
            order.errorMessage = response.data?.message || "Top-up failed";
            await orderRepo.save(order);
            console.log("Order marked FAILED:", order.id, "error:", order.errorMessage);

            return res.status(400).json({
                status: false,
                message: "Top-up failed",
                data: response.data
            });
        }
    } catch (err: any) {
        console.error("Unexpected error in postUserTopUpOrder:", err?.message || err, err?.stack || "");

        // ✅ Handle unexpected errors — ensure order + transaction are marked failed
        if (req.body?.transactionId) {
            try {
                const transactionRepo = AppDataSource.getRepository(Transaction);
                const orderRepo = AppDataSource.getRepository(Order);
                const transaction = await transactionRepo.findOne({
                    where: { id: req.body.transactionId },
                });
                if (transaction) {
                    transaction.status = "FAILED";
                    await transactionRepo.save(transaction);
                    console.log("Transaction set to FAILED in catch:", transaction.id);
                }

                const order = await orderRepo.findOne({
                    where: { transaction: { id: req.body.transactionId } },
                });
                if (order) {
                    order.status = "FAILED";
                    order.errorMessage = err.message;
                    await orderRepo.save(order);
                    console.log("Order set to FAILED in catch:", order.id, "error:", err.message);
                }
            } catch (innerErr: any) {
                console.error("Failed to mark transaction/order failed in catch block:", innerErr?.message || innerErr);
            }
        }

        return res.status(500).json({
            status: false,
            message: "Internal Server Error",
            error: err.message,
        });
    }
};


export const getUserTopUpOrderList = async () => {

}

export const getUserTopUpOrderListById = async () => {

}

export const getUserTopUpPlans = async (req: any, res: Response) => {
    const { id, role } = req.user;
    if (role !== 'user') {
        return res.status(403).json({ status: false, message: "Forbidden" });
    }

    if (!id) {
        return res.status(401).json({ status: false, message: "Unauthorized" });
    }

    const { simId } = req.query;

    if (!simId || typeof simId !== "string") {
        return res.status(400).json({ status: false, message: "SIM ID is required" });
    }

    try {
        const esimRepo = AppDataSource.getRepository(Esim);
        const topupRepo = AppDataSource.getRepository(TopUpPlan);

        // 1️⃣ Fetch the eSIM to get its country
        const esim = await esimRepo.findOne({
            where: { id: simId },
            relations: ["country"],
        });

        if (!esim) {
            return res.status(404).json({ status: false, message: "eSIM not found" });
        }

        const countryId = esim.country.id;

        // 2️⃣ Fetch all active top-up plans for this country
        const topUpPlans = await topupRepo.find({
            where: { isActive: true, country: { id: countryId } },
            order: { price: "ASC" }, // optional: sort by price
        });

        return res.status(200).json({
            status: true,
            data: topUpPlans,
            esim
        });
    } catch (err: any) {
        console.error("Error fetching top-up plans:", err);
        return res.status(500).json({ status: false, message: "Internal Server Error" });
    }
};
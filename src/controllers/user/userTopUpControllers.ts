import { Response } from "express";
import { CartItem } from "../../entity/CartItem.entity";
import { Cart } from "../../entity/Carts.entity";
import { TopUpPlan } from "../../entity/Topup.entity";
import { AppDataSource } from "../../data-source";
import { Esim } from "../../entity/Esim.entity";
import { Transaction, TransactionStatus } from "../../entity/Transactions.entity";
import { User } from "../../entity/User.entity";
import axios from "axios";
import { Order, OrderType } from "../../entity/order.entity";
import { EsimTopUp } from "../../entity/EsimTopUp.entity";
// sendTopUpUserNotification
import { sendAdminOrderNotification, sendTopUpUserNotification } from "../../utils/email";
export const postUserTopUpOrder = async (req: any, res: Response) => {
    const { id } = req.user || {};
    const { topupId, transactionId, esimId } = req.body;

    console.log("POST /topup - payload:", { topupId, transactionId, esimId, userId: id });

    if (!id)
        return res.status(401).json({ status: false, message: "Unauthorized" });

    if (!topupId || !transactionId || !esimId)
        return res.status(400).json({
            status: false,
            message: "topupId, transactionId and esimId are required",
        });

    try {
        const userRepo = AppDataSource.getRepository(User);
        const esimRepo = AppDataSource.getRepository(Esim);
        const topUpRepo = AppDataSource.getRepository(TopUpPlan);
        const transactionRepo = AppDataSource.getRepository(Transaction);
        const orderRepo = AppDataSource.getRepository(Order);
        const esimTopUpRepo = AppDataSource.getRepository(EsimTopUp);

        const user = await userRepo.findOne({ where: { id } });
        const topUp:any = await topUpRepo.findOne({ where: { id: topupId } });
        const esim: any = await esimRepo.findOne({
            where: { id: esimId },
            relations: ["country", "plans"],
        });
        const transaction = await transactionRepo.findOne({
            where: { id: transactionId },
            relations: ["user", "esim"],
        });

        if (!user) return res.status(404).json({ status: false, message: "User not found" });
        if (!topUp) return res.status(404).json({ status: false, message: "Top-up plan not found" });
        if (!esim) return res.status(404).json({ status: false, message: "eSIM not found" });
        if (!transaction) return res.status(404).json({ status: false, message: "Transaction not found" });

        // Ensure eSIM has a base plan
        if (!Array.isArray(esim.plans) || esim.plans.length === 0) {
            transaction.status = TransactionStatus.FAILED;
            await transactionRepo.save(transaction);
            return res.status(400).json({
                status: false,
                message: "eSIM has no associated plan to top-up",
            });
        }

        const planId = esim.plans[0]?.id;

        // -------------------- FIX: MAKE IDEMPOTENT --------------------
        const existingOrder = await orderRepo.findOne({
            where: { transaction: { id: transactionId } },
        });

        if (existingOrder) {
            return res.status(200).json({
                status: true,
                message: "Order already exists",
                orderId: existingOrder.id,
            });
        }
        // ---------------------------------------------------------------

        // Create new order
        const order = orderRepo.create({
            user,
            transaction,
            country: esim.country,
            totalAmount: Number(transaction.amount || 0),
            status: "PENDING",
            name: `${user?.firstName || ""} ${user?.lastName || ""}`.trim(),
            email: user?.email || "",
            phone: user?.phone || "",
            activated: false,
            type: OrderType.TOP_UP,
        });
        await orderRepo.save(order);

        // Send top-up request to provider
        const formdata = new FormData();
        formdata.append("product_plan_id", topUp?.topupId);
        formdata.append("product_id", planId);
        formdata.append("iccid", esim.iccid);

        const response = await axios.post(
            `${process.env.TURISM_URL}/v2/sims/${esim.iccid}/topup`,
            formdata,
            {
                headers: {
                    Authorization: `Bearer ${req?.thirdPartyToken}`,
                    "Content-Type": "multipart/form-data",
                },
            }
        );

        console.log("----- response.data top up ----", response.data);

        // -------------------- SUCCESS CASE --------------------
        if (response.data?.status === "success") {
            transaction.status = TransactionStatus.SUCCESS;
            await transactionRepo.save(transaction);

            order.status = "COMPLETED";
            order.activated = true;
            await orderRepo.save(order);

            // Save in EsimTopUp table
            const esimTopUp = esimTopUpRepo.create({
                esim,
                topup: topUp,
                order,
            });
            await esimTopUpRepo.save(esimTopUp);

            await sendAdminOrderNotification(order);
            await sendTopUpUserNotification(order);

            return res.status(200).json({
                status: true,
                message: "Top-up successful",
                orderId: order.id,
                data: response.data,
            });
        }

        // -------------------- FAILURE CASE --------------------
        transaction.status = TransactionStatus.FAILED;
        await transactionRepo.save(transaction);

        order.status = "FAILED";
        order.errorMessage = response.data?.message || "Top-up failed";
        await orderRepo.save(order);

        const failedTopUp = esimTopUpRepo.create({
            esim,
            topup: topUp,
            order,
        });
        await esimTopUpRepo.save(failedTopUp);

        await sendAdminOrderNotification(order);
        await sendTopUpUserNotification(order);

        return res.status(400).json({
            status: false,
            message: "Top-up failed",
            data: response.data,
        });
    } catch (err: any) {
        console.error("Unexpected error in postUserTopUpOrder:", err?.message || err);

        // Fallback failure marking
        try {
            const transactionRepo = AppDataSource.getRepository(Transaction);
            const orderRepo = AppDataSource.getRepository(Order);

            const transaction = await transactionRepo.findOne({
                where: { id: req.body?.transactionId },
            });

            const order = await orderRepo.findOne({
                where: { transaction: { id: req.body?.transactionId } },
            });

            if (transaction) {
                transaction.status = TransactionStatus.FAILED;
                await transactionRepo.save(transaction);
            }

            if (order) {
                order.status = "FAILED";
                order.errorMessage = err.message;
                await orderRepo.save(order);
            }
        } catch {}

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

        const countryId = esim?.country.id;

        console.log("----- country id -----", countryId);

        // 2️⃣ Fetch all active top-up plans for this country
        const topUpPlans = await topupRepo.find({
            where: { isActive: true, country: { id: countryId } },
            order: { price: "ASC" }, // optional: sort by price
        });

        console.log("----- topUpPlans id -----", topUpPlans);
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
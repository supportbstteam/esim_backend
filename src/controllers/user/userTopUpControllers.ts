import { Response } from "express";
import { CartItem } from "../../entity/CartItem.entity";
import { Cart } from "../../entity/Carts.entity";
import { TopUpPlan } from "../../entity/Topup.entity";
import { AppDataSource } from "../../data-source";
import { Esim } from "../../entity/Esim.entity";
import { Transaction } from "../../entity/Transactions.entity";
import { User } from "../../entity/User.entity";
import axios from "axios";
import { Order } from "../../entity/order.entity";

export const postUserTopUpOrder = async (req: any, res: Response) => {
    const { id } = req.user || {}; // ✅ fixed destructuring bug
    const { topupId, transactionId, esimId } = req.body;

    if (!id) {
        return res.status(401).json({ status: false, message: "Unauthorized" });
    }

    if (!topupId || !transactionId || !esimId) {
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
        const topUp = await topUpRepo.findOne({ where: { id: topupId } });
        const esim = await esimRepo.findOne({
            where: { id: esimId },
            relations: ["country"], // ✅ add this
        });
        const transaction = await transactionRepo.findOne({ where: { id: transactionId } });

        if (!user) return res.status(404).json({ status: false, message: "User not found" });
        if (!topUp) return res.status(404).json({ status: false, message: "Top-up plan not found" });
        if (!esim) return res.status(404).json({ status: false, message: "eSIM not found" });
        if (!transaction) return res.status(404).json({ status: false, message: "Transaction not found" });


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
            name: user?.firstName + " " + user?.lastName,
            email: user.email,
            activated: false
        });

        await orderRepo.save(order);

        console.log("------Initiating top-up  id-------", topUp.topupId)

        // ✅ Prepare request to third-party API
        const formdata: any = new FormData();
        formdata.append("product_plan_id", topUp.topupId);
        formdata.append("iccid", esim.iccid);

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

        console.log("------Top-up response -------", response.data);

        if (response.data?.status === "success") {
            // ✅ Update transaction + order on success
            transaction.status = "SUCCESS";
            await transactionRepo.save(transaction);

            order.status = "COMPLETED";
            order.activated = true;
            await orderRepo.save(order);

            return res.status(200).json({
                status: true,
                message: "Top-up successful",
                data: response.data
            });
        } else {
            // ❌ Top-up failed — record the failure
            transaction.status = "FAILED";
            await transactionRepo.save(transaction);

            order.status = "FAILED";
            order.errorMessage = response.data?.message || "Top-up failed";
            await orderRepo.save(order);

            return res.status(400).json({
                status: false,
                message: "Top-up failed",
                data: response.data
            });
        }
    } catch (err: any) {
        // ✅ Handle unexpected errors — ensure order + transaction are marked failed
        if (req.body?.transactionId) {
            const transactionRepo = AppDataSource.getRepository(Transaction);
            const orderRepo = AppDataSource.getRepository(Order);
            const transaction = await transactionRepo.findOne({
                where: { id: req.body.transactionId },
            });
            if (transaction) {
                transaction.status = "FAILED";
                await transactionRepo.save(transaction);
            }

            const order = await orderRepo.findOne({
                where: { transaction: { id: req.body.transactionId } },
            });
            if (order) {
                order.status = "FAILED";
                order.errorMessage = err.message;
                await orderRepo.save(order);
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
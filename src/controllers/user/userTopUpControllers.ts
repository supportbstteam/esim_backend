import axios from "axios";
import { AppDataSource } from "../../data-source";
import { CartItem } from "../../entity/CartItem.entity";
import { Cart } from "../../entity/Carts.entity";
import { Esim } from "../../entity/Esim.entity";
import { Order } from "../../entity/order.entity";
import { TopUpPlan } from "../../entity/Topup.entity";
import { Transaction } from "../../entity/Transactions.entity";
import { User } from "../../entity/User.entity";
import { Response } from 'express'

export const postUserTopUpOrder = async (req: any, res: Response) => {
    const { id: userId, topUpId, iccid, transactionId } = req.body;

    if (!userId || !topUpId || !iccid || !transactionId) {
        return res.status(400).json({ message: "userId, topUpId, iccid, and transactionId are required" });
    }

    try {
        const userRepo = AppDataSource.getRepository(User);
        const topUpRepo = AppDataSource.getRepository(TopUpPlan);
        const esimRepo = AppDataSource.getRepository(Esim);
        const orderRepo = AppDataSource.getRepository(Order);
        const transactionRepo = AppDataSource.getRepository(Transaction);

        const user = await userRepo.findOne({ where: { id: userId } });
        if (!user) return res.status(404).json({ message: "User not found" });

        const topUpPlan = await topUpRepo.findOne({
            where: { id: topUpId, isDeleted: false, isActive: true },
            relations: ["country"],
        });
        if (!topUpPlan) return res.status(404).json({ message: "Top-Up Plan not found" });

        const esim = await esimRepo.findOne({ where: { iccid, user: { id: userId } } });
        if (!esim) return res.status(404).json({ message: "eSIM not found for user" });

        const transaction = await transactionRepo.findOne({ where: { id: transactionId } });
        if (!transaction) return res.status(404).json({ message: "Transaction not found" });

        // Call 3rd-party API for top-up
        const formData = new URLSearchParams();
        formData.append("iccid", iccid);
        formData.append("product_plan_id", topUpPlan.topupId.toString());

        const response = await axios.post(`${process.env.TURISM_URL}/v2/sims/${iccid}/topup`, formData, {
            headers: {
                Authorization: `Bearer ${req.thirdPartyToken}`,
                "Content-Type": "application/x-www-form-urlencoded",
            },
        });

        if (response.data?.status !== "success") {
            throw new Error(response.data?.message || "Top-up failed");
        }

        // Create Order record
        const order = orderRepo.create({
            userId: user.id,
            userName: `${user.firstName} ${user.lastName}`,
            userEmail: user.email,
            // userPhone: user.phone,
            orderType: "TOPUP",
            orderName: topUpPlan.name,
            aboutOrder: topUpPlan.title,
            baseAmount: parseFloat(topUpPlan.price.toString()),
            totalAmount: parseFloat(topUpPlan.price.toString()),
            status: "COMPLETED",
            activated: true,
            topupName: topUpPlan.name,
            topupTitle: topUpPlan.title,
            topupPrice: parseFloat(topUpPlan.price.toString()),
            topupDataLimit: topUpPlan.dataLimit,
            topupValidityDays: topUpPlan.validityDays,
            topupCurrency: topUpPlan.currency,
            transaction,
            // plan: null,
            user,
        });

        await orderRepo.save(order);

        // Attach top-up to eSIM
        esim.topUps = [...(esim.topUps || []), topUpPlan];
        await esimRepo.save(esim);

        return res.status(201).json({
            message: "Top-Up Order completed successfully",
            orderId: order.id,
            topUpPlanId: topUpPlan.id,
            esimId: esim.id,
        });
    } catch (err: any) {
        console.error("❌ Top-Up Order error:", err.message || err);
        return res.status(500).json({
            message: "Top-Up Order failed",
            error: err.message || "Server error",
        });
    }
};

// Get all top-up orders for the authenticated user
export const getUserTopUpOrderList = async (req: any, res: Response) => {
    const userId = req.user?.id;

    if (!userId) {
        return res.status(401).json({ message: "Unauthorized", status: "error" });
    }

    try {
        const orderRepo = AppDataSource.getRepository(Order);

        const orders = await orderRepo.find({
            where: { userId, orderType: "TOPUP" },
            order: { createdAt: "DESC" },
        });

        const formattedOrders = orders.map((order) => ({
            id: order.id,
            topupName: order.topupName,
            topupTitle: order.topupTitle,
            topupPrice: order.topupPrice,
            topupDataLimit: order.topupDataLimit,
            topupValidityDays: order.topupValidityDays,
            topupCurrency: order.topupCurrency,
            status: order.status,
            activated: order.activated,
            errorMessage: order.errorMessage,
            userName: order.userName,
            userEmail: order.userEmail,
            userPhone: order.userPhone,
            createdAt: order.createdAt,
        }));

        return res.status(200).json({
            message: "Top-up orders fetched successfully",
            status: "success",
            data: formattedOrders,
        });
    } catch (err: any) {
        console.error("Error fetching top-up orders:", err);
        return res.status(500).json({
            message: "Failed to fetch top-up orders",
            status: "error",
            error: err.message,
        });
    }
};

// Get a single top-up order by ID for authenticated user
export const getUserTopUpOrderListById = async (req: any, res: Response) => {
    const userId = req.user?.id;
    const { orderId } = req.params;

    if (!userId) {
        return res.status(401).json({ message: "Unauthorized", status: "error" });
    }

    try {
        const orderRepo = AppDataSource.getRepository(Order);

        const order = await orderRepo.findOne({
            where: { id: orderId, userId, orderType: "TOPUP" },
        });

        if (!order) {
            return res.status(404).json({ message: "Top-up order not found", status: "error" });
        }

        return res.status(200).json({
            message: "Top-up order fetched successfully",
            status: "success",
            data: {
                id: order.id,
                topupName: order.topupName,
                topupTitle: order.topupTitle,
                topupPrice: order.topupPrice,
                topupDataLimit: order.topupDataLimit,
                topupValidityDays: order.topupValidityDays,
                topupCurrency: order.topupCurrency,
                status: order.status,
                activated: order.activated,
                errorMessage: order.errorMessage,
                userName: order.userName,
                userEmail: order.userEmail,
                userPhone: order.userPhone,
                createdAt: order.createdAt,
            },
        });
    } catch (err: any) {
        console.error("Error fetching top-up order:", err);
        return res.status(500).json({
            message: "Failed to fetch top-up order",
            status: "error",
            error: err.message,
        });
    }
};

export const getUserTopUp = async (req: any, res: Response) => {
    try {
        const { countryId } = req.query;

        if (!countryId) {
            return res.status(400).json({ message: "countryId query parameter is required", status: "error" });
        }

        const topUpRepo = AppDataSource.getRepository(TopUpPlan);

        const topUps = await topUpRepo.find({
            where: {
                country: { id: countryId },
                isDeleted: false,
                isActive: true,
            },
            relations: ["country"],
            order: { price: "ASC" },
        });

        if (!topUps.length) {
            return res.status(404).json({ message: "No top-up plans found for this country", status: "error" });
        }

        const formattedTopUps = topUps.map((topUp) => ({
            id: topUp.id,
            topupId: topUp.topupId,
            name: topUp.name,
            title: topUp.title,
            price: topUp.price,
            dataLimit: topUp.dataLimit,
            validityDays: topUp.validityDays,
            isUnlimited: topUp.isUnlimited,
            currency: topUp.currency,
            countryName: topUp.country.name,
            countryIsoCode: topUp.country.isoCode,
        }));

        return res.status(200).json({
            message: "Top-up plans fetched successfully",
            status: "success",
            data: formattedTopUps,
        });
    } catch (err: any) {
        console.error("Error fetching top-up plans:", err);
        return res.status(500).json({
            message: "Failed to fetch top-up plans",
            status: "error",
            error: err.message,
        });
    }
};
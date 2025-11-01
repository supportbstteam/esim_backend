import { Request, Response } from "express";
import { Order, OrderType } from "../../entity/order.entity";
import { User } from "../../entity/User.entity";
import { AppDataSource } from "../../data-source";

// Get all orders (with optional pagination)
export const getAllOrders = async (req: Request, res: Response) => {
    try {
        const orderRepo = AppDataSource.getRepository(Order);

        const orders = await orderRepo
            .createQueryBuilder("order")
            .leftJoinAndSelect("order.transaction", "transaction")
            .leftJoinAndSelect("order.country", "country")
            .leftJoinAndSelect("order.esims", "esims")
            .where("esims.id IS NOT NULL")
            .orderBy("order.createdAt", "DESC")
            .getMany();

        // ✅ Response structure focusing on Order-level customer info
        const formattedOrders = orders.map((order) => ({
            id: order.id,
            orderCode: order.orderCode,
            totalAmount: order.totalAmount,
            status: order.status,
            name: order.name,
            email: order.email,
            phone: order.phone ?? null, // newly added field
            type: order.type,
            activated: order.activated,
            errorMessage: order.errorMessage,
            createdAt: order.createdAt,
            updatedAt: order.updatedAt,
            transaction: order.transaction,
            country: order.country,
            esims: order.esims,
        }));

        return res.status(200).json({
            message: "Orders fetched successfully",
            status: "success",
            data: formattedOrders,
        });
    } catch (err: any) {
        console.error("--- Error in getAllOrders ---", err);
        return res.status(500).json({
            message: "Failed to fetch orders",
            status: "error",
            error: err.message,
        });
    }
};

// ✅ Get Order by ID (with user details included from order table)
export const getOrderById = async (req: Request, res: Response) => {
    const { id } = req.params;

    try {
        const orderRepo = AppDataSource.getRepository(Order);

        const order = await orderRepo.findOne({
            where: { id },
            relations: [
                "user",
                "transaction",
                "country",
                "esims",
                "esims.country",
                "esims.topupLinks",
                "esims.topupLinks.topup",
            ],
        });

        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found" });
        }

        // ✅ Extract customer details directly from order table
        const customerDetails = {
            firstName: order.name.split(" ")[0] || order.user?.firstName || null,
            lastName: order.name.split(" ")[1] || order.user?.lastName || null,
            email: order.email || order.user?.email || null,
            phone: order.phone || order.user?.phone || null,
        };

        // ✅ Cleaned response structure for frontend clarity
        return res.status(200).json({
            success: true,
            message: "Order fetched successfully",
            data: {
                id: order.id,
                orderCode: order.orderCode,
                totalAmount: order.totalAmount,
                status: order.status,
                createdAt: order.createdAt,
                updatedAt: order.updatedAt,
                errorMessage:order?.errorMessage,
                customer: customerDetails,
                country: order.country,
                transaction: order.transaction,
                esims: order.esims,
            },
        });
    } catch (err: any) {
        console.error("--- Error in getOrderById ---", err);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch order",
            error: err.message,
        });
    }
};


// Get all orders for a specific user
export const getOrderByUser = async (req: Request, res: Response) => {
    const { userId } = req.params;
    try {
        const userRepo = AppDataSource.getRepository(User);
        const user = await userRepo.findOne({ where: { id: userId } });

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        const orderRepo = AppDataSource.getRepository(Order);
        const orders = await orderRepo.find({
            where: { user: { id: userId } },
            relations: ["plan", "transaction", "esim", "country"],
            order: { createdAt: "DESC" },
        });

        return res.status(200).json({ orders });
    } catch (err: any) {
        console.error("--- Error in getOrderByUser ---", err.message);
        return res.status(500).json({ message: "Failed to fetch user orders", error: err.message });
    }
};

// Update order status or activation
export const updateOrderStatus = async (req: Request, res: Response) => {
    const { id } = req.params;
    const { status, activated, errorMessage } = req.body;

    try {
        const orderRepo = AppDataSource.getRepository(Order);
        const order = await orderRepo.findOne({ where: { id } });

        if (!order) {
            return res.status(404).json({ message: "Order not found" });
        }

        if (status !== undefined) order.status = status;
        if (activated !== undefined) order.activated = activated;
        if (errorMessage !== undefined) order.errorMessage = errorMessage;

        await orderRepo.save(order);

        return res.status(200).json({ message: "Order updated successfully", order });
    } catch (err: any) {
        console.error("--- Error in updateOrderStatus ---", err.message);
        return res.status(500).json({ message: "Failed to update order", error: err.message });
    }
};

// Soft-delete an order (if needed)
export const deleteOrder = async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
        const orderRepo = AppDataSource.getRepository(Order);
        const order = await orderRepo.findOne({ where: { id } });

        if (!order) {
            return res.status(404).json({ message: "Order not found" });
        }

        // Soft delete approach: mark as deleted instead of removing from DB
        // You can add a column `isDeleted` in Order entity if not present
        // order.isDeleted = true;
        // await orderRepo.save(order);

        // Or if hard delete is acceptable:
        await orderRepo.remove(order);

        return res.status(200).json({ message: "Order deleted successfully" });
    } catch (err: any) {
        console.error("--- Error in deleteOrder ---", err.message);
        return res.status(500).json({ message: "Failed to delete order", error: err.message });
    }
};

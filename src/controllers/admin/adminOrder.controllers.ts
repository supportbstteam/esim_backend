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
            .leftJoinAndSelect("order.user", "user")
            .leftJoinAndSelect("order.transaction", "transaction")
            .leftJoinAndSelect("order.country", "country")
            .leftJoinAndSelect("order.esims", "esims")
            // .where("order.type = :type", { type: OrderType.ESIM })
            .where("esims.id IS NOT NULL") // ✅ proper SQL syntax
            .orderBy("order.createdAt", "DESC")
            .getMany();


        return res.status(200).json({ orders });
    } catch (err: any) {
        console.error("--- Error in getAllOrders ---", err);
        return res.status(500).json({
            message: "Failed to fetch orders",
            error: err.message,
        });
    }
};

// Get order by ID
export const getOrderById = async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
        const orderRepo = AppDataSource.getRepository(Order);
        const order = await orderRepo.findOne({
            where: { id },
            relations: ["user", "plan", "transaction", "esim", "country"],
        });

        if (!order) {
            return res.status(404).json({ message: "Order not found" });
        }

        return res.status(200).json({ order });
    } catch (err: any) {
        console.error("--- Error in getOrderById ---", err.message);
        return res.status(500).json({ message: "Failed to fetch order", error: err.message });
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

// ✅ Get all Top-Up orders
export const getAllTopUpOrders = async (req: Request, res: Response) => {
    try {
        const orderRepo = AppDataSource.getRepository(Order);

        const orders = await orderRepo
            .createQueryBuilder("order")
            .leftJoinAndSelect("order.user", "user")
            .leftJoinAndSelect("order.transaction", "transaction")
            .leftJoinAndSelect("order.country", "country")
            .where("order.type = :type", { type: "top up" })
            .orderBy("order.createdAt", "DESC")
            .getMany();

        return res.status(200).json({ orders });
    } catch (err: any) {
        console.error("--- Error in getAllTopUpOrders ---", err);
        return res.status(500).json({
            message: "Failed to fetch top-up orders",
            error: err.message,
        });
    }
};

// ✅ Get Top-Up order by ID
export const getTopUpOrderById = async (req: Request, res: Response) => {
    const { id } = req.params;

    try {
        const orderRepo = AppDataSource.getRepository(Order);
        const order = await orderRepo.findOne({
            where: { id, type: OrderType.TOP_UP },
            relations: ["user", "transaction", "country"],
        });

        if (!order) {
            return res.status(404).json({ message: "Top-up order not found" });
        }

        return res.status(200).json({ order });
    } catch (err: any) {
        console.error("--- Error in getTopUpOrderById ---", err.message);
        return res.status(500).json({ message: "Failed to fetch top-up order", error: err.message });
    }
};

// ✅ Get all Top-Up orders for a specific user
export const getTopUpOrdersByUser = async (req: Request, res: Response) => {
    const { userId } = req.params;

    try {
        const userRepo = AppDataSource.getRepository(User);
        const user = await userRepo.findOne({ where: { id: userId } });

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        const orderRepo = AppDataSource.getRepository(Order);
        const orders = await orderRepo.find({
            where: { user: { id: userId }, type: OrderType.TOP_UP },
            relations: ["transaction", "country"],
            order: { createdAt: "DESC" },
        });

        return res.status(200).json({ orders });
    } catch (err: any) {
        console.error("--- Error in getTopUpOrdersByUser ---", err.message);
        return res.status(500).json({ message: "Failed to fetch user top-up orders", error: err.message });
    }
};

// ✅ Update Top-Up order status or activation
export const updateTopUpOrderStatus = async (req: Request, res: Response) => {
    const { id } = req.params;
    const { status, activated, errorMessage } = req.body;

    try {
        const orderRepo = AppDataSource.getRepository(Order);
        const order = await orderRepo.findOne({ where: { id, type: OrderType.TOP_UP } });

        if (!order) {
            return res.status(404).json({ message: "Top-up order not found" });
        }

        if (status !== undefined) order.status = status;
        if (activated !== undefined) order.activated = activated;
        if (errorMessage !== undefined) order.errorMessage = errorMessage;

        await orderRepo.save(order);

        return res.status(200).json({ message: "Top-up order updated successfully", order });
    } catch (err: any) {
        console.error("--- Error in updateTopUpOrderStatus ---", err.message);
        return res.status(500).json({ message: "Failed to update top-up order", error: err.message });
    }
};

// ✅ Delete Top-Up order (soft or hard)
export const deleteTopUpOrder = async (req: Request, res: Response) => {
    const { id } = req.params;

    try {
        const orderRepo = AppDataSource.getRepository(Order);
        const order = await orderRepo.findOne({ where: { id, type: OrderType.TOP_UP } });

        if (!order) {
            return res.status(404).json({ message: "Top-up order not found" });
        }

        await orderRepo.remove(order);

        return res.status(200).json({ message: "Top-up order deleted successfully" });
    } catch (err: any) {
        console.error("--- Error in deleteTopUpOrder ---", err.message);
        return res.status(500).json({ message: "Failed to delete top-up order", error: err.message });
    }
};
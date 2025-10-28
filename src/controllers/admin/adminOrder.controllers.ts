import { Request, Response } from "express";
import { Order } from "../../entity/order.entity";
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
      .where("esims.id IS NOT NULL") // ✅ ensures only orders with eSIMs
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

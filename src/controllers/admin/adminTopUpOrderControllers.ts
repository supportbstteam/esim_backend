import { Request, Response } from "express";
import { Order, OrderType } from "../../entity/order.entity";
import { User } from "../../entity/User.entity";
import { AppDataSource } from "../../data-source";
import { Esim } from "../../entity/Esim.entity";
import { checkAdmin } from "../../utils/checkAdmin";
import { EsimTopUp } from "../../entity/EsimTopUp.entity";

// ✅ Get all Top-Up orders
export const getAllTopUpOrders = async (req: Request, res: Response) => {
  try {
    const orderRepo = AppDataSource.getRepository(Order);

    const orders = await orderRepo
      .createQueryBuilder("order")
      .leftJoinAndSelect("order.transaction", "transaction")
      .leftJoinAndSelect("order.country", "country")
      .leftJoinAndSelect("order.esims", "esims")
      .leftJoinAndSelect("esims.topupLinks", "topupLinks")
      .leftJoinAndSelect("topupLinks.topup", "topupPlan")
      .where("order.type = :type", { type: OrderType.TOP_UP })
      .andWhere("order.orderCode LIKE :prefix", { prefix: "ETUP%" })
      .orderBy("order.createdAt", "DESC")
      .getMany();

    // ✅ Inject a consistent "user" object (for backward compatibility)
    const formattedOrders = orders.map((order) => ({
      ...order,
      user: {
        id: null, // since actual user relation isn’t being joined
        firstName: (order.name).split(" ")[0] || "",
        lastName: (order.name).split(" ")[1] || "",
        email: order.email || null,
        phone: order.phone || null,
      },
    }));

    return res.status(200).json({
      message: "Top-up orders fetched successfully",
      status: "success",
      orders: formattedOrders,
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

// ✅ Get Top-Up order by ID (same response as adminUserAllESimById)
export const getTopUpOrderById = async (req: Request, res: Response) => {
  // 🧩 Only admin can access
  if (!checkAdmin(req, res)) return res.status(403).json({ message: "Unauthorized" });

  const { id } = req.params; // `id` = Top-Up Order ID

  if (!id) {
    return res.status(400).json({
      status: "error",
      message: "Top-Up Order ID is required",
    });
  }

  try {
    const orderRepo = AppDataSource.getRepository(Order);
    const esimTopupRepo = AppDataSource.getRepository(EsimTopUp);

    // 🧠 1️⃣ Fetch the top-up order first
    const order = await orderRepo.findOne({
      where: { id, type: OrderType.TOP_UP },
      relations: [
        "user",
        "transaction",
        // "transaction.user",
        "transaction.charges",
        "country",
      ],
    });

    if (!order) {
      return res.status(404).json({
        status: "error",
        message: "Top-Up order not found",
      });
    }

    // 🧠 2️⃣ Find the corresponding EsimTopUp link for this order
    const esimTopup = await esimTopupRepo.findOne({
      where: { order: { id: order.id } },
      relations: [
        "esim",
        "esim.country",
        "esim.order",
        "esim.order.transaction",
        // "esim.order.transaction.user",
        "esim.order.transaction.charges",
        "topup",
      ],
    });

    if (!esimTopup) {
      return res.status(404).json({
        status: "error",
        message: "No linked eSIM/Top-Up found for this order",
      });
    }

    const { esim, topup } = esimTopup;

    // 🧠 3️⃣ Build normalized response (same structure as adminUserAllESimById)
    const formattedResponse = {
      id: order.id,
      name: order.name || "",
      orderCode: order.orderCode || "",
      status: order.status || "",
      totalAmount: order.totalAmount || "",
      type: order.type || "top up",
      createdAt: order.createdAt,
      errorMessage:order?.errorMessage,
      updatedAt: order.updatedAt,
      transaction: order.transaction || null,
      country: order.country || null,
      email: order.transaction?.user?.email || null,
      esims: [
        {
          id: esim?.id || null,
          iccid: esim?.iccid || "",
          productName: esim?.productName || "",
          currency: esim?.currency || "",
          price: esim?.price || "",
          dataAmount: esim?.dataAmount || "",
          validityDays: esim?.validityDays || "",
          qrCodeUrl: esim?.qrCodeUrl || "",
          startDate: esim?.startDate || null,
          endDate: esim?.endDate || null,
          createdAt: esim?.createdAt || null,
          updatedAt: esim?.updatedAt || null,
          country: esim?.country || null,
          order: esim?.order || null,
          topUps: topup ? [topup] : [],
          isActive: esim?.isActive || false,
          statusText: esim?.statusText || "",
        },
      ],
    };

    return res.status(200).json({
      message: "Top-Up order details fetched successfully",
      status: "success",
      data: formattedResponse,
    });
  } catch (err: any) {
    console.error("Error fetching Top-Up order details:", err);
    return res.status(500).json({
      message: "Failed to fetch Top-Up order details",
      status: "error",
      error: err.message,
    });
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
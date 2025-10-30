import { Response } from "express";
import { Plan } from "../../entity/Plans.entity";
import { getDataSource } from "../../lib/serverless";
import axios from "axios";
import { Reservation } from "../../entity/Reservation.entity";
import { Country } from "../../entity/Country.entity";
import { User } from "../../entity/User.entity";
import { Order, OrderType } from "../../entity/order.entity";
import { Esim } from "../../entity/Esim.entity";
import { Transaction } from "../../entity/Transactions.entity";
import { Charges } from "../../entity/Charges.entity";
import { AppDataSource } from "../../data-source";
import { Cart } from "../../entity/Carts.entity";
import { CartItem } from "../../entity/CartItem.entity";
import { Refund } from "../../entity/Refund.entity";
import { sendOrderEmail } from "../../utils/email";
import { EsimTopUp } from "../../entity/EsimTopUp.entity";

export const postOrder = async (req: any, res: Response) => {
  const { transactionId } = req.body;
  const userId = req.user?.id;
  const thirdPartyToken = { Authorization: `Bearer ${req.thirdPartyToken}` };

  if (!transactionId || !userId) {
    return res.status(400).json({ message: "transactionId and userId are required" });
  }

  const transactionRepo = AppDataSource.getRepository(Transaction);
  const cartRepo = AppDataSource.getRepository(Cart);
  const orderRepo = AppDataSource.getRepository(Order);
  const esimRepo = AppDataSource.getRepository(Esim);
  const userRepo = AppDataSource.getRepository(User);

  let latestCart: Cart | null = null;
  let mainOrder: Order | null = null;

  try {
    const transaction = await transactionRepo.findOne({
      where: { id: transactionId },
      relations: ["user", "cart", "cart.items", "cart.items.plan", "cart.items.plan.country"],
    });

    const user = await userRepo.findOneBy({ id: userId });
    if (!user) throw new Error("User not found");

    if (!transaction) throw new Error("Transaction not found");
    if (transaction.status !== "SUCCESS") throw new Error(`Invalid transaction status: ${transaction.status}`);

    latestCart = transaction.cart ?? null;
    if (!latestCart || latestCart.isDeleted || latestCart.isCheckedOut || latestCart.isError) {
      throw new Error("No valid cart found for this transaction");
    }

    const validCartItems = latestCart.items.filter((i) => !i.isDeleted);
    if (!validCartItems.length) throw new Error("No valid cart items found");

    // Create order
    mainOrder = orderRepo.create({
      user: transaction.user,
      transaction,
      name: `${user.firstName || ""} ${user.lastName || ""}`.trim(),
      email: user.email,
      status: "processing",
      activated: false,
      totalAmount: 0,
      country: validCartItems[0].plan.country,
      type: OrderType.ESIM,
      // orderCode: `${OrderType.ESIM}${String(counter).padStart(4, "0")}`;
    });
    await orderRepo.save(mainOrder);

    const createdEsims: Esim[] = [];

    for (const item of validCartItems) {
      const plan = item.plan;
      for (let i = 0; i < item.quantity; i++) {
        try {
          const reserveResponse = await axios.get(
            `${process.env.TURISM_URL}/v2/sims/reserve?product_plan_id=${plan.planId}`,
            { headers: thirdPartyToken }
          );

          if (reserveResponse.data?.status !== "success") {
            throw new Error(reserveResponse.data?.message || "Failed to reserve eSIM");
          }

          const externalReserveId = reserveResponse.data.data?.id;
          const createSimResponse = await axios.post(
            `${process.env.TURISM_URL}/v2/sims/${externalReserveId}/purchase`,
            {},
            { headers: thirdPartyToken }
          );

          const esimData = createSimResponse.data?.data;
          const esim = esimRepo.create({
            externalId: esimData.id?.toString(),
            iccid: esimData.iccid || null,
            qrCodeUrl: esimData.qr_code_url || null,
            networkStatus: esimData.network_status || null,
            statusText: esimData.status_text || null,
            productName: esimData.name || plan.name,
            currency: esimData.currency || null,
            price: parseFloat(esimData.price) || parseFloat(plan.price),
            validityDays: esimData.validity_days || plan.validityDays,
            dataAmount: esimData.data || 0,
            callAmount: esimData.call || 0,
            smsAmount: esimData.sms || 0,
            isActive: esimData.network_status !== "NOT_ACTIVE",
            startDate: new Date(),
            endDate: new Date(
              new Date().setDate(new Date().getDate() + (esimData.validity_days || plan.validityDays || 30))
            ),
            country: plan.country,
            user: transaction.user,
            plans: [plan],
            order: mainOrder,
          });
          await esimRepo.save(esim);
          createdEsims.push(esim);
          mainOrder.totalAmount = parseFloat((transaction?.amount).toString() || "0");
        } catch (innerErr: any) {
          // If one SIM fails, continue to next but mark partial error
          mainOrder.errorMessage = innerErr.message;
          await orderRepo.save(mainOrder);
        }
      }
    }

    mainOrder.status = createdEsims.length ? "completed" : "failed";
    mainOrder.activated = createdEsims.length > 0;
    await orderRepo.save(mainOrder);

    latestCart.isCheckedOut = true;
    await cartRepo.save(latestCart);

    await sendOrderEmail(
      user.email,
      `${user.firstName} ${user.lastName}`,
      {
        id: mainOrder.id,
        totalAmount: mainOrder.totalAmount,
        activated: mainOrder.activated,
        esims: createdEsims,
      },
      mainOrder.status ? "completed" : "failed"
    );

    return res.status(201).json({
      message: "Order completed successfully",
      order: { ...mainOrder, esims: createdEsims, transaction: transaction },
    });
  } catch (err: any) {
    console.error("❌ postOrder error:", err);
    if (mainOrder) {
      mainOrder.status = "failed";
      mainOrder.errorMessage = err.message;
      await orderRepo.save(mainOrder);
    }
    return res.status(500).json({ message: "Order failed", error: err.message });
  }
};


export const getOrderListByUser = async (req: any, res: Response) => {
  const { id, role } = req.user;
  if (!id || role !== "user") return res.status(401).json({ message: "Unauthorized", status: "error" });

  try {
    const orderRepo = AppDataSource.getRepository(Order);
    const orders = await orderRepo.find({
      where: { user: { id } },
      relations: ["esims", "transaction", "transaction.user", "transaction.charges", "country"],
      order: { createdAt: "DESC" },
    });

    const formattedOrders = orders.map(order => {
      const esims = Array.isArray(order.esims) ? order.esims : [];
      return {
        id: order.id || order?.orderCode,
        code: order?.orderCode || order.id,
        planNames: esims.map(e => e.productName || "N/A"),
        totalPlans: esims.length,
        totalData: esims.reduce((acc, e) => acc + (e.dataAmount || 0), 0),
        totalSms: esims.reduce((acc, e) => acc + (e.smsAmount || 0), 0),
        totalAmount: order?.totalAmount,
        country: order.country?.name || "Unknown",
        isoCode: order.country?.isoCode || null,
        phoneCode: order.country?.phoneCode || null,
        isActive: !!order.activated,
        status: order.status,
        errorMessage: order.errorMessage || null,
        createdAt: order.createdAt,
      };
    });

    return res.status(200).json({ status: "success", message: "Orders fetched successfully", data: formattedOrders });
  } catch (err: any) {
    console.error("❌ Error fetching orders:", err);
    return res.status(500).json({ status: "error", message: "Failed to fetch orders", error: err.message });
  }
};

export const getOrderDetailsByUser = async (req: any, res: Response) => {
  const { id, role } = req.user;
  const { orderId } = req.params;

  if (!id || role !== "user") {
    return res.status(401).json({ message: "Unauthorized", status: "error" });
  }

  if (!orderId) {
    return res
      .status(400)
      .json({ message: "Order ID is required", status: "error" });
  }

  try {
    const orderRepo = AppDataSource.getRepository(Order);
    const esimTopupRepo = AppDataSource.getRepository(EsimTopUp);

    const order = await orderRepo.findOne({
      where: { id: orderId, user: { id } },
      relations: [
        "transaction",
        "transaction.user",
        "transaction.charges",
        "country",
      ],
    });

    if (!order)
      return res
        .status(404)
        .json({ message: "Order not found", status: "error" });

    // 🧠 CASE 1: Top-up order → Fetch from EsimTopUp table
    if (order.orderCode?.startsWith("ETUP") && order.type === "top up") {
      const esimTopUps = await esimTopupRepo.find({
        where: { order: { id: order.id } },
        relations: [
          "esim",
          "esim.country",
          "esim.user",
          "topup",
          "topup.country",
        ],
      });

      const esims = esimTopUps.map((et) => ({
        ...et.esim,
        topUps: et.topup ? [et.topup] : [],
      }));

      const formattedOrder = {
        ...order,
        esims,
      };

      return res.status(200).json({
        message: "Top-up order details fetched successfully",
        status: "success",
        data: formattedOrder,
      });
    }

    // 🧠 CASE 2: Normal eSIM order → Fetch as before
    const fullOrder = await orderRepo.findOne({
      where: { id: orderId, user: { id } },
      relations: [
        "esims",
        "esims.topupLinks",
        "esims.topupLinks.topup",
        "transaction",
        "transaction.user",
        "transaction.charges",
        "country",
      ],
    });

    if (!fullOrder) {
      return res
        .status(404)
        .json({ message: "Order not found", status: "error" });
    }

    const formattedOrder = {
      ...fullOrder,
      esims: fullOrder.esims.map((esim) => ({
        ...esim,
        topUps: esim.topupLinks?.map((link) => link.topup) || [],
      })),
    };

    return res.status(200).json({
      message: "Order details fetched successfully",
      status: "success",
      data: formattedOrder,
    });
  } catch (err: any) {
    console.error("Error fetching order details:", err);
    return res.status(500).json({
      message: "Failed to fetch order details",
      status: "error",
      error: err.message,
    });
  }
};


export const postTransaction = async (req: any, res: Response) => {

}


// -------------------- plan -------------
export const getUserAllSims = async (req: any, res: Response) => {
  const { id, role } = req.user;

  if (!id || role !== "user") return res.status(401).json({ message: "Unauthorized", status: "error" });

  try {
    const esimRepo = AppDataSource.getRepository(Esim);
    const esims = await esimRepo.find({
      where: { user: { id } },
      relations: ["order", "order.transaction", "order.country"],
      order: {
        createdAt: "DESC"
      }
    });

    return res.status(200).json({ message: "All eSIMs fetched successfully", status: "success", data: esims });
  } catch (err: any) {
    console.error("Error fetching all eSIMs:", err);
    return res.status(500).json({ message: "Failed to fetch all eSIMs", status: "error", error: err.message });
  }
}

export const getUserEsimDetails = async (req: any, res: Response) => {
  const { id: userId, role } = req.user;
  const { esimId } = req.params;

  if (!userId || role !== "user") {
    return res.status(401).json({ message: "Unauthorized", status: "error" });
  }

  if (!esimId) {
    return res
      .status(400)
      .json({ message: "eSIM ID is required", status: "error" });
  }

  try {
    const esimRepo = AppDataSource.getRepository(Esim);
    const esimTopupRepo = AppDataSource.getRepository(EsimTopUp);
    const orderRepo = AppDataSource.getRepository(Order);

    // 🧠 Step 1: Find the eSIM belonging to the user
    const esim = await esimRepo.findOne({
      where: { id: esimId, user: { id: userId } },
      relations: [
        "order",
        "order.country",
        "order.transaction",
        "order.transaction.user",
        "order.transaction.charges",
        "country",
      ],
    });

    if (!esim)
      return res
        .status(404)
        .json({ message: "eSIM not found", status: "error" });

    const order = esim.order;
    if (!order)
      return res
        .status(404)
        .json({ message: "Order not found for this eSIM", status: "error" });

    // 🧠 Step 2: Handle case based on order type
    if (order.orderCode?.startsWith("ETUP") && order.type === "top up") {
      // 🟢 CASE: Top-Up Order
      const esimTopUps = await esimTopupRepo.find({
        where: { esim: { id: esim.id } },
        relations: ["topup", "topup.country", "esim.country"],
      });

      const formattedOrder = {
        ...order,
        esims: [
          {
            ...esim,
            topUps: esimTopUps.map((et) => et.topup).filter(Boolean),
          },
        ],
      };

      return res.status(200).json({
        message: "Top-up eSIM details fetched successfully",
        status: "success",
        data: formattedOrder,
      });
    }

    // 🟣 CASE: Normal eSIM Order
    const fullEsim = await esimRepo.findOne({
      where: { id: esimId },
      relations: [
        "topupLinks",
        "topupLinks.topup",
        "country",
        "order",
        "order.transaction",
        "order.transaction.user",
        "order.transaction.charges",
        "order.country",
      ],
    });

    if (!fullEsim)
      return res
        .status(404)
        .json({ message: "eSIM not found", status: "error" });

    const formattedOrder = {
      ...order,
      esims: [
        {
          ...fullEsim,
          topUps: fullEsim.topupLinks?.map((link) => link.topup) || [],
        },
      ],
    };

    return res.status(200).json({
      message: "eSIM details fetched successfully",
      status: "success",
      data: formattedOrder,
    });
  } catch (err: any) {
    console.error("Error fetching eSIM details:", err);
    return res.status(500).json({
      message: "Failed to fetch eSIM details",
      status: "error",
      error: err.message,
    });
  }
};

export const getUserSimSummary = async (req: any, res: Response) => {
  console.log("=== HIT getUserSimSummary route ===");
  console.log("Request user:", req.user);

  // return res.status(200).json({ message: "eSIM summary fetched successfully", status: "success", data: {} });

  const { id, role } = req.user;

  if (!id || role !== "user") {
    console.log("Unauthorized access attempt");
    return res.status(401).json({ message: "Unauthorized", status: "error" });
  }

  try {
    const esimRepo = AppDataSource.getRepository(Esim);
    console.log("Repository initialized:", !!esimRepo);

    // Fetch all eSIMs (linked directly or through an order)
    const esims = await esimRepo.find({
      where: [
        { user: { id } },
        { order: { user: { id } } },
      ],
      relations: ["user", "plans", "order", "order.user", "country"],
      order: { createdAt: "DESC" },
    });

    console.log("------- esims fetched for summary --------", esims.length);
    if (esims.length > 0) {
      console.log("First eSIM record:", esims[0]);
    }

    if (!esims.length) {
      console.log("No eSIMs found for this user");
      return res.status(200).json({
        message: "No eSIMs found for this user",
        status: "success",
        data: {
          totalSims: 0,
          activeSims: 0,
          inactiveSims: 0,
          totalData: 0,
          planSummary: [],
        },
      });
    }

    // --- Stats ---
    const totalSims = esims.length;
    const activeSims = esims.filter((e) => e.isActive).length;
    const inactiveSims = totalSims - activeSims;

    console.log("Stats: totalSims =", totalSims, "activeSims =", activeSims, "inactiveSims =", inactiveSims);

    // --- Group by Plan ---
    const planSummary = new Map<
      string,
      {
        planId: string;
        name: string;
        simsBought: number;
        totalData: number;
        isUnlimited: boolean;
      }
    >();

    for (const esim of esims) {
      for (const plan of esim.plans || []) {
        if (!planSummary.has(plan.id)) {
          planSummary.set(plan.id, {
            planId: plan.id,
            name: plan.title || plan.name,
            simsBought: 0,
            totalData: 0,
            isUnlimited: plan.isUnlimited,
          });
        }

        const summary = planSummary.get(plan.id)!;
        summary.simsBought += 1;

        if (!plan.isUnlimited && plan.data) {
          summary.totalData += Number(plan.data);
        }
      }
    }

    const planSummaryArray = Array.from(planSummary.values());
    const totalData = planSummaryArray.reduce((sum, p) => sum + p.totalData, 0);
    console.log("Plan summary:", planSummaryArray);
    console.log("Total data across all plans:", totalData);

    // --- Response ---
    return res.status(200).json({
      message: "eSIM summary fetched successfully",
      status: "success",
      data: {
        totalSims,
        activeSims,
        inactiveSims,
        totalData,
        planSummary: planSummaryArray,
      },
    });
  } catch (err: any) {
    console.error("Error fetching eSIM summary:", err);
    return res.status(500).json({
      message: "Failed to fetch eSIM summary",
      status: "error",
      error: err.message,
    });
  }
};

export const postUserClaimRefund = async (req: any, res: Response) => {
  const { id, role } = req.user;

  // 🔐 Validate user identity
  if (!id || role !== "user") {
    return res.status(401).json({
      message: "Unauthorized! Invalid account credentials.",
    });
  }

  const { orderId, transactionId, message, firstName, lastName, email, phone } = req.body;

  // 🧾 Basic data validation
  if (!orderId || !transactionId) {
    return res.status(400).json({
      message: "Order ID and Transaction ID are required.",
    });
  }

  try {
    const userRepo = AppDataSource.getRepository(User);
    const orderRepo = AppDataSource.getRepository(Order);
    const transactionRepo = AppDataSource.getRepository(Transaction);
    const refundRepo = AppDataSource.getRepository(Refund);

    // 🔍 Fetch user
    const user = await userRepo.findOne({
      where: { id },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    // 🔍 Fetch order
    const order = await orderRepo.findOne({
      where: { id: orderId },
      relations: ["user", "transaction"],
    });

    if (!order) {
      return res.status(404).json({ message: "Order not found." });
    }

    // 🔍 Fetch transaction
    const transaction = await transactionRepo.findOne({
      where: { id: transactionId },
    });

    if (!transaction) {
      return res.status(404).json({ message: "Transaction not found." });
    }

    // 🧠 Business rule validation
    if (
      order.status.toLowerCase() !== "failed" &&
      order?.user?.id !== id &&
      order.transaction.id !== transactionId
    ) {
      return res.status(400).json({
        message: "Refund cannot be claimed for this order.",
      });
    }

    // 🛑 Check if refund already exists for this order
    const existingRefund = await refundRepo.findOne({
      where: { order: { id: orderId }, isDeleted: false },
    });

    // if (existingRefund) {
    //   return res.status(400).json({
    //     message: "Refund already claimed for this order.",
    //   });
    // }

    // 💾 Create new refund record
    const refund = refundRepo.create({
      firstName: firstName || user.firstName,
      lastName: lastName || user.lastName,
      email: email || user.email,
      phone: phone || user?.phone,
      message: message || "User requested a refund.",
      order,
      transaction,
      userId: user?.id,
      isDeleted: false,
      status: "pending",
    });

    await refundRepo.save(refund);

    return res.status(201).json({
      message: "Refund request submitted successfully.",
      data: refund,
    });
  } catch (err: any) {
    console.error("---- error in the claim refund order ------", err);
    return res.status(500).json({
      message: "Something went wrong while processing your refund request.",
      error: err.message,
    });
  }
};
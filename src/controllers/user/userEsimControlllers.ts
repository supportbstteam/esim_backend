import { Response } from "express";
import { Plan } from "../../entity/Plans.entity";
import { getDataSource } from "../../lib/serverless";
import axios from "axios";
import { Reservation } from "../../entity/Reservation.entity";
import { Country } from "../../entity/Country.entity";
import { User } from "../../entity/User.entity";
import { Order } from "../../entity/order.entity";
import { Esim } from "../../entity/Esim.entity";
import { Transaction } from "../../entity/Transactions.entity";
import { Charges } from "../../entity/Charges.entity";
import { AppDataSource } from "../../data-source";
import { Cart } from "../../entity/Carts.entity";
import { CartItem } from "../../entity/CartItem.entity";

export const postOrder = async (req: any, res: Response) => {
  const { transactionId } = req.body;
  const userId = req.user?.id;
  const thirdPartyToken = { Authorization: `Bearer ${req.thirdPartyToken}` };

  if (!transactionId || !userId) {
    return res.status(400).json({ message: "transactionId and userId are required" });
  }

  const transactionRepo = AppDataSource.getRepository(Transaction);
  const orderRepo = AppDataSource.getRepository(Order);
  const esimRepo = AppDataSource.getRepository(Esim);
  const cartRepo = AppDataSource.getRepository(Cart);

  let cart: Cart | null = null;

  try {
    const transaction = await transactionRepo.findOne({
      where: { id: transactionId },
      relations: ["user", "cart", "cart.items", "cart.items.plan", "cart.items.plan.country"],
    });

    if (!transaction) return res.status(404).json({ message: "Transaction not found" });
    if (transaction.status !== "SUCCESS")
      return res.status(400).json({ message: `Transaction status is '${transaction.status}'` });

    cart = transaction.cart ?? null;
    if (!cart || cart.isDeleted || cart.isCheckedOut || cart.isError) return res.status(400).json({ message: "Cart not found or deleted" });

    const validCartItems = cart.items.filter(item => !item.isDeleted);
    if (!validCartItems.length) return res.status(400).json({ message: "No valid cart items found" });

    // Nested try/catch for order creation
    try {
      const mainOrder = orderRepo.create({
        user: transaction.user,
        name: `${transaction.user.firstName} ${transaction.user.lastName}`,
        email: transaction.user.email,
        status: "processing",
        activated: false,
        totalAmount: 0,
        transaction,
        country: validCartItems[0].plan.country,
      });
      await orderRepo.save(mainOrder);

      const createdEsims: Esim[] = [];

      for (const item of validCartItems) {
        const plan = item.plan;

        for (let i = 0; i < item.quantity; i++) {
          // Reserve eSIM
          const reserveResponse = await axios.get(
            `${process.env.TURISM_URL}/v2/sims/reserve?product_plan_id=${plan.planId}`,
            { headers: thirdPartyToken }
          );
          if (reserveResponse.data?.status !== "success") throw new Error(reserveResponse.data?.message || "Reservation failed");

          const externalReserveId = reserveResponse.data.data?.id;
          if (!externalReserveId) throw new Error("Invalid reservation ID");

          // Purchase eSIM
          const createSimResponse = await axios.post(
            `${process.env.TURISM_URL}/v2/sims/${externalReserveId}/purchase`,
            {},
            { headers: thirdPartyToken }
          );
          const esimData = createSimResponse.data?.data;
          if (!esimData) throw new Error("Failed to purchase eSIM");

          // Save eSIM
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
            endDate: new Date(new Date().setDate(new Date().getDate() + (esimData.validity_days || plan.validityDays || 30))),
            country: plan.country,
            user: transaction.user,
            plans: [plan],
            order: mainOrder,
          });
          await esimRepo.save(esim);
          createdEsims.push(esim);

          mainOrder.totalAmount += parseFloat(plan.price);
        }
      }

      mainOrder.status = "completed";
      mainOrder.activated = true;
      await orderRepo.save(mainOrder);

      cart.isCheckedOut = true;
      await cartRepo.save(cart);

      transaction.status = "SUCCESS";
      await transactionRepo.save(transaction);

      return res.status(201).json({
        message: "Order completed successfully",
        order: {
          id: mainOrder.id,
          totalAmount: mainOrder.totalAmount,
          status: mainOrder.status,
          activated: mainOrder.activated,
          country: { id: mainOrder.country.id, name: mainOrder.country.name },
          transaction: {
            id: transaction.id,
            status: transaction.status,
            paymentGateway: transaction.paymentGateway,
            amount: transaction.amount,
            createdAt: transaction.createdAt,
          },
          esims: createdEsims.map(e => ({
            id: e.id,
            externalId: e.externalId,
            iccid: e.iccid,
            qrCodeUrl: e.qrCodeUrl,
            productName: e.productName,
            price: e.price,
            validityDays: e.validityDays,
            isActive: e.isActive,
            startDate: e.startDate,
            endDate: e.endDate,
            dataAmount: e.dataAmount,
            callAmount: e.callAmount,
            smsAmount: e.smsAmount,
          })),
        },
      });

    } catch (err: any) {
      // Mark cart as error if order creation fails
      if (cart) {
        cart.isError = true;
        cart.isCheckedOut = false;
        await cartRepo.save(cart);
      }
      throw err;
    }

  } catch (err: any) {
    console.error("❌ postOrder error:", err.message || err);
    return res.status(500).json({ message: "Order process failed", error: err.message || "Server error" });
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
        id: order.id,
        planNames: esims.map(e => e.productName || "N/A"),
        totalPlans: esims.length,
        totalData: esims.reduce((acc, e) => acc + (e.dataAmount || 0), 0),
        totalSms: esims.reduce((acc, e) => acc + (e.smsAmount || 0), 0),
        totalAmount: esims.reduce((acc, e) => acc + (Number(e.price) || 0), 0),
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

  if (!id || role !== "user") return res.status(401).json({ message: "Unauthorized", status: "error" });
  if (!orderId) return res.status(400).json({ message: "Order ID is required", status: "error" });

  try {
    const orderRepo = AppDataSource.getRepository(Order);
    const order = await orderRepo.findOne({
      where: { id: orderId, user: { id } },
      relations: ["esims", "transaction", "transaction.user", "transaction.charges", "country"],
    });

    if (!order) return res.status(404).json({ message: "Order not found", status: "error" });

    return res.status(200).json({ message: "Order details fetched successfully", status: "success", data: order });
  } catch (err: any) {
    console.error("Error fetching order details:", err);
    return res.status(500).json({ message: "Failed to fetch order details", status: "error", error: err.message });
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
  const { id, role } = req.user;
  const { esimId } = req.params;

  if (!id || role !== "user") return res.status(401).json({ message: "Unauthorized", status: "error" });
  if (!esimId) return res.status(400).json({ message: "eSIM ID is required", status: "error" });

  try {
    const esimRepo = AppDataSource.getRepository(Esim);
    const esim = await esimRepo.findOne({
      where: { id: esimId, user: { id } },
      relations: ["order", "order.transaction", "order.country", "plans", "topUps"],
    });
    if (!esim) return res.status(404).json({ message: "eSIM not found", status: "error" });

    return res.status(200).json({ message: "eSIM details fetched successfully", status: "success", data: esim });
  }
  catch (err: any) {
    console.error("Error fetching eSIM details:", err);
    return res.status(500).json({ message: "Failed to fetch eSIM details", status: "error", error: err.message });
  }

}

export const getUserSimSummary = async (req: any, res: Response) => {
  console.log("=== HIT getUserSimSummary route ===");
  console.log("Request user:", req.user);

  return res.status(200).json({ message: "eSIM summary fetched successfully", status: "success", data: {} });

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

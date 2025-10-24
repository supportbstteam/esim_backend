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
  const { id } = req.user;
  const thirdPartyToken = { Authorization: `Bearer ${req.thirdPartyToken}` };

  if (!transactionId || !id) {
    return res.status(400).json({ message: "transactionId and userId are required" });
  }

  try {
    const transactionRepo = AppDataSource.getRepository(Transaction);
    const orderRepo = AppDataSource.getRepository(Order);
    const esimRepo = AppDataSource.getRepository(Esim);
    const cartRepo = AppDataSource.getRepository(Cart);

    const transaction = await transactionRepo.findOne({
      where: { id: transactionId },
      relations: ["user", "cart", "cart.items", "cart.items.plan", "cart.items.plan.country"],
    });

    if (!transaction) return res.status(404).json({ message: "Transaction not found" });
    if (transaction.status !== "SUCCESS") return res.status(400).json({ message: `Transaction status is '${transaction.status}'` });

    const cart = transaction.cart;
    if (!cart || cart.isDeleted) return res.status(400).json({ message: "Cart not found or deleted" });

    const validCartItems = cart.items.filter(item => !item.isDeleted);
    if (!validCartItems.length) return res.status(400).json({ message: "No valid cart items found" });

    // Create main order
    const mainOrder = orderRepo.create({
      user: transaction.user,
      name: `${transaction.user.firstName} ${transaction.user.lastName}`,
      email: transaction.user.email,
      status: "processing",
      activated: false,
      totalAmount: 0,
      transaction,
      country: validCartItems[0].plan.country, // fix FK
    });
    await orderRepo.save(mainOrder);

    const createdEsims: Esim[] = [];

    for (const item of validCartItems) {
      const plan = item.plan;
      for (let i = 0; i < item.quantity; i++) {
        // Reserve
        const reserveResponse = await axios.get(`${process.env.TURISM_URL}/v2/sims/reserve?product_plan_id=${plan.planId}`, { headers: thirdPartyToken });
        if (reserveResponse.data?.status !== "success") throw new Error(reserveResponse.data?.message || "Reservation failed");

        const externalReserveId = reserveResponse.data.data?.id;
        if (!externalReserveId) throw new Error("Invalid reservation ID");

        // Purchase
        const createSimResponse = await axios.post(`${process.env.TURISM_URL}/v2/sims/${externalReserveId}/purchase`, {}, { headers: thirdPartyToken });
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
          country: plan.country, // fix FK
          user: transaction.user,
          plans: [plan],
          order: mainOrder, // link order
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
        country: {
          id: mainOrder.country.id,
          name: mainOrder.country.name,
        },
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

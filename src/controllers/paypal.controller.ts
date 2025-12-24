import { Request, Response } from "express";
import paypal from "@paypal/checkout-server-sdk";
import { paypalClient } from "../lib/paypal";
import { AppDataSource } from "../data-source";
import { Transaction, TransactionStatus } from "../entity/Transactions.entity";
import { Cart } from "../entity/Carts.entity";
import { TopUpPlan } from "../entity/Topup.entity";
import { User } from "../entity/User.entity";

export const createPaypalOrder = async (req: any, res: Response) => {
  try {
    const user = req.user;
    const { amount, cartId, topupId } = req.body;

    const numericAmount = Number(amount);

    if (!numericAmount || isNaN(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({ message: "Invalid amount" });
    }

    const transactionRepo: any = AppDataSource.getRepository(Transaction);
    const cartrepo = AppDataSource.getRepository(Cart);
    const topupRepo = AppDataSource.getRepository(TopUpPlan);
    const userRepo = AppDataSource.getRepository(User);

    let cart: Cart | null = null;
    let topup: TopUpPlan | null = null;

    // const user = userRep 
    console.log("-=-=-=-= user- -=-=-=-=",user);

    /* -------------------- Validate Input -------------------- */
    if (!cartId && !topupId) {
      return res.status(400).json({
        message: "Either cartId or topupId is required",
      });
    }

    if (cartId && topupId) {
      return res.status(400).json({
        message: "Only one of cartId or topupId is allowed",
      });
    }

    /* -------------------- Fetch Source -------------------- */
    if (cartId) {
      cart = await cartrepo.findOne({
        where: {
          id: cartId,
          user: { id: user.id },
        },
      });

      if (!cart) {
        return res.status(404).json({ message: "Cart not found" });
      }
    }

    if (topupId) {
      topup = await topupRepo.findOne({
        where: { id: topupId },
      });

      if (!topup) {
        return res.status(404).json({ message: "Top-up plan not found" });
      }
    }

    /* -------------------- Create Transaction -------------------- */
    const transaction = transactionRepo.create({
      user,
      paymentGateway: "PAYPAL",
      amount: numericAmount,
      status: TransactionStatus.PENDING,
      source: "WEB",
      cart: cart ?? null,
      TopUpPlan: topup ?? null,
    });


    await transactionRepo.save(transaction);

    // 2️⃣ Create PayPal order
    const request = new paypal.orders.OrdersCreateRequest();
    request.prefer("return=representation");

    request.requestBody({
      intent: "CAPTURE",

      application_context: {
        brand_name: "E-SIM AERO",
        user_action: "PAY_NOW",
        shipping_preference: "NO_SHIPPING", // ✅ removes shipping address
      },

      purchase_units: [
        {
          amount: {
            currency_code: "USD",
            value: numericAmount.toFixed(2),
          },
        },
      ],
    });

    const order = await paypalClient.execute(request);

    // 3️⃣ Save PayPal order ID
    transaction.transactionId = order.result.id;
    await transactionRepo.save(transaction);

    console.log("-=-=-=-=-=- transaction -=-=-=-=-=", transaction);

    return res.json({
      paypalOrderId: order.result.id,
      transactionId: transaction.id,
    });
  } catch (err) {
    console.error("PayPal create order error:", err);
    return res.status(500).json({ message: "Failed to create PayPal order" });
  }
};


export const capturePaypalOrder = async (req: Request, res: Response) => {
  try {
    const { paypalOrderId } = req.body;

    if (!paypalOrderId) {
      return res.status(400).json({ message: "PayPal order ID required" });
    }

    const transactionRepo = AppDataSource.getRepository(Transaction);

    const transaction = await transactionRepo.findOne({
      where: { transactionId: paypalOrderId },
    });

    if (!transaction) {
      return res.status(404).json({ message: "Transaction not found" });
    }

    // 1️⃣ Capture payment
    const request: any = new paypal.orders.OrdersCaptureRequest(paypalOrderId);

    // PayPal TS fix
    request.requestBody({
      payment_source: {},
    });

    const capture = await paypalClient.execute(request);

    const status = capture.result.status;

    transaction.status =
      status === "COMPLETED"
        ? TransactionStatus.SUCCESS
        : TransactionStatus.FAILED;

    transaction.response = JSON.stringify(capture.result);

    await transactionRepo.save(transaction);

    return res.json({
      status: transaction.status,
      transactionId: transaction.id,
    });
  } catch (err) {
    console.error("PayPal capture error:", err);
    return res.status(500).json({ message: "PayPal capture failed" });
  }
};

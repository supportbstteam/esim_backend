import { Request, Response } from "express";
import paypal from "@paypal/checkout-server-sdk";
import { paypalClient } from "../lib/paypal";
import { AppDataSource } from "../data-source";
import { Transaction, TransactionStatus } from "../entity/Transactions.entity";
import { Cart } from "../entity/Carts.entity";
import { TopUpPlan } from "../entity/Topup.entity";
import { User } from "../entity/User.entity";
import { CartItem } from "../entity/CartItem.entity";
import { Esim } from "../entity/Esim.entity";

export const createPaypalOrder = async (req: any, res: Response) => {
  try {
    const { amount, cartId, topupId, esimId } = req.body;
    const user = req.user;

    const numericAmount = Number(amount);
    if (!numericAmount || numericAmount <= 0) {
      return res.status(400).json({ message: "Invalid amount" });
    }

    if ((!cartId && !topupId) || (cartId && topupId)) {
      return res.status(400).json({
        message: "Either cartId or topupId is required (not both)",
      });
    }

    // if (topupId && !esimId) {
    //   return res.status(400).json({
    //     message: "esimId is required ",
    //   });
    // }

    const transactionRepo = AppDataSource.getRepository(Transaction);
    const cartRepo = AppDataSource.getRepository(Cart);
    const cartItemRepo = AppDataSource.getRepository(CartItem);
    const topupRepo = AppDataSource.getRepository(TopUpPlan);
    const esimRepo = AppDataSource.getRepository(Esim);

    let items: any[] = [];
    let description = "";
    let cart: Cart | null = null;
    let topup: TopUpPlan | null = null;

    /* ---------------- Fetch source ---------------- */
    if (cartId) {
      cart = await cartRepo.findOne({
        where: { id: cartId, user: { id: user.id } },
      });
      if (!cart) return res.status(404).json({ message: "Cart not found" });

      const cartItems = await cartItemRepo.find({
        where: { cart: { id: cartId } },
        relations: ["plan"],
      });
      if (!cartItems.length) {
        return res.status(404).json({ message: "Cart items not found" });
      }

      items = cartItems.map((i) => ({
        name: i.plan.name,
        description: `${i.plan.data}GB · ${i.plan.validityDays} days`,
        quantity: String(i.quantity),
        unit_amount: {
          currency_code: "USD",
          value: Number(i.plan.price).toFixed(2),
        },
        category: "DIGITAL_GOODS",
      }));

      description = "eSIM purchase";
    }

    if (topupId) {
      topup = await topupRepo.findOne({ where: { id: topupId } });
      if (!topup) {
        return res.status(404).json({ message: "Top-up plan not found" });
      }




      items = [
        {
          name: topup.title,
          description: `${topup.dataLimit}GB Top-up`,
          quantity: "1",
          unit_amount: {
            currency_code: "USD",
            value: Number(topup.price).toFixed(2),
          },
          category: "DIGITAL_GOODS",
        },
      ];

      description = "eSIM top-up";
    }

    const itemTotal = items.reduce(
      (sum, i) => sum + Number(i.unit_amount.value) * Number(i.quantity),
      0
    );

    // const esim = await esimRepo.findOne({
    //   where: { id: esimId }
    // });

    // if (!esim) {
    //   return res.status(404).json({ message: "eSIM not found" });
    // }

    /* ---------------- Create transaction ---------------- */
    const transaction = transactionRepo.create({
      user,
      paymentGateway: "PAYPAL",
      amount: itemTotal,
      status: TransactionStatus.PENDING,
      source: "WEB",
      cart: cart || undefined,
      topupPlan: topup || undefined,
      // esim: esim || undefined,
    });
    await transactionRepo.save(transaction);

    /* ---------------- Create PayPal order ---------------- */
    const request = new paypal.orders.OrdersCreateRequest();
    request.prefer("return=representation");

    request.requestBody({
      intent: "CAPTURE",
      application_context: {
        brand_name: "E-SIM AERO",
        user_action: "PAY_NOW",
        shipping_preference: "NO_SHIPPING",
      },
      purchase_units: [
        {
          reference_id: transaction.id,
          description,
          amount: {
            currency_code: "USD",
            value: itemTotal.toFixed(2),
            breakdown: {
              item_total: {
                currency_code: "USD",
                value: itemTotal.toFixed(2),
              },
              shipping: { currency_code: "USD", value: "0.00" },
              handling: { currency_code: "USD", value: "0.00" },
              tax_total: { currency_code: "USD", value: "0.00" },
              insurance: { currency_code: "USD", value: "0.00" },
              shipping_discount: { currency_code: "USD", value: "0.00" },
              discount: { currency_code: "USD", value: "0.00" },
            },
          },
          items,
        },
      ],
    });

    const order = await paypalClient.execute(request);

    transaction.transactionId = order.result.id;
    await transactionRepo.save(transaction);

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

export const createPaypalOrderMobile = async (req: any, res: Response) => {
  try {
    const { amount, cartId, topupId, esimId } = req.body;
    const user = req.user;

    const numericAmount = Number(amount);
    if (!numericAmount || numericAmount <= 0) {
      console.log("not a number triggered in cart");
      return res.status(400).json({ message: "Invalid amount" });
    }

    console.log("-=-=-=- cartId and amount -=-=-=", cartId, amount);

    if ((!cartId && !topupId) || (cartId && topupId)) {
      console.log("not a number triggered in top up");
      return res.status(400).json({
        message: "Either cartId or topupId is required (not both)",
      });
    }

    if (topupId && !esimId) {
      return res.status(400).json({
        message: "esimId is required ",
      });
    }

    const transactionRepo = AppDataSource.getRepository(Transaction);
    const cartRepo = AppDataSource.getRepository(Cart);
    const cartItemRepo = AppDataSource.getRepository(CartItem);
    const topupRepo = AppDataSource.getRepository(TopUpPlan);
    const esimRepo = AppDataSource.getRepository(Esim);

    let items: any[] = [];
    let description = "";
    let cart: Cart | null = null;
    let topup: TopUpPlan | null = null;

    /* ---------------- Fetch source ---------------- */
    if (cartId) {
      cart = await cartRepo.findOne({
        where: { id: cartId, user: { id: user.id } },
      });
      if (!cart) return res.status(404).json({ message: "Cart not found" });

      const cartItems = await cartItemRepo.find({
        where: { cart: { id: cartId } },
        relations: ["plan"],
      });

      items = cartItems.map((i) => ({
        name: i.plan.name,
        description: `${i.plan.data}GB · ${i.plan.validityDays} days`,
        quantity: String(i.quantity),
        unit_amount: {
          currency_code: "USD",
          value: Number(i.plan.price).toFixed(2),
        },
        category: "DIGITAL_GOODS",
      }));

      description = "eSIM purchase";
    }

    if (topupId) {
      topup = await topupRepo.findOne({ where: { id: topupId } });
      if (!topup)
        return res.status(404).json({ message: "Top-up plan not found" });

      items = [
        {
          name: topup.title,
          description: `${topup.dataLimit}GB Top-up`,
          quantity: "1",
          unit_amount: {
            currency_code: "USD",
            value: Number(topup.price).toFixed(2),
          },
          category: "DIGITAL_GOODS",
        },
      ];

      description = "eSIM top-up";
    }

    

    const esim = await esimRepo.findOne({
      where: { id: esimId }
    });

    if (!esim) {
      return res.status(404).json({ message: "eSIM not found" });
    }

    const itemTotal = items.reduce(
      (sum, i) => sum + Number(i.unit_amount.value) * Number(i.quantity),
      0
    );

    /* ---------------- Create transaction ---------------- */
    const transaction = transactionRepo.create({
      user,
      paymentGateway: "PAYPAL",
      amount: itemTotal,
      status: TransactionStatus.PENDING,
      source: "MOBILE",
      cart: cart || undefined,
      topupPlan: topup || undefined,
      esim: esim || undefined,
    });
    await transactionRepo.save(transaction);

    /* ---------------- Create PayPal order (MOBILE) ---------------- */
    const request = new paypal.orders.OrdersCreateRequest();
    request.prefer("return=representation");

    request.requestBody({
      intent: "CAPTURE",
      application_context: {
        brand_name: "E-SIM AERO",
        user_action: "PAY_NOW",
        shipping_preference: "NO_SHIPPING",

        // 🔑 MOBILE REDIRECTS (used by WebView)
        return_url: `${process.env.BACKEND_URL}/user/paypal/processing`, 
        cancel_url: `${process.env.BACKEND_URL}/user/paypal/cancel`,
      },
      purchase_units: [
        {
          reference_id: transaction.id,
          description,
          amount: {
            currency_code: "USD",
            value: itemTotal.toFixed(2),
            breakdown: {
              item_total: {
                currency_code: "USD",
                value: itemTotal.toFixed(2),
              },
              shipping: {
                currency_code: "USD",
                value: "0.00",
              },
              handling: {
                currency_code: "USD",
                value: "0.00",
              },
              tax_total: {
                currency_code: "USD",
                value: "0.00",
              },
              insurance: {
                currency_code: "USD",
                value: "0.00",
              },
              shipping_discount: {
                currency_code: "USD",
                value: "0.00",
              },
              discount: {
                currency_code: "USD",
                value: "0.00",
              },
            },
          },
          items,
        },
      ],
    });

    const order = await paypalClient.execute(request);

    const approvalUrl = order.result.links?.find(
      (l: any) => l.rel === "approve"
    )?.href;

    if (!approvalUrl) {
      return res
        .status(500)
        .json({ message: "PayPal approval URL not found" });
    }

    transaction.transactionId = order.result.id;
    await transactionRepo.save(transaction);

    return res.json({
      paypalOrderId: order.result.id,
      transactionId: transaction.id,
      approvalUrl, // 🔥 REQUIRED BY RN WEBVIEW
    });
  } catch (err) {
    console.error("PayPal mobile create order error:", err);
    return res
      .status(500)
      .json({ message: "Failed to create PayPal mobile order" });
  }
};

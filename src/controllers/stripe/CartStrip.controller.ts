import { Request, Response } from "express";
import { AppDataSource } from "../../data-source";
import Stripe from "stripe";
import { Cart } from "../../entity/Carts.entity";
import { User } from "../../entity/User.entity";
import { Esim } from "../../entity/Esim.entity";
import { Transaction, TransactionStatus } from "../../entity/Transactions.entity";
import { TopUpPlan } from "../../entity/Topup.entity";
import { EsimTopUp } from "../../entity/EsimTopUp.entity";
import { Order, ORDER_STATUS, OrderType } from "../../entity/order.entity";
import { CartItem } from "../../entity/CartItem.entity";
import { v4 as uuid } from "uuid";
import { createOrderAfterPayment } from "../../utils/createOrderAfterPayment";
import { processMobileTopUp } from "../../utils/TopupBusinessLogic";
import paypal from "@paypal/checkout-server-sdk";
import { paypalClient } from "../../lib/paypal";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
    apiVersion: "2025-09-30.clover" as any,
});

export const initiateTransaction = async (req: any, res: Response) => {
    const userId = req.user.id;

    try {
        const userRepo = AppDataSource.getRepository(User);
        const cartRepo = AppDataSource.getRepository(Cart);
        const cartItem = AppDataSource.getRepository(CartItem);
        const transactionRepo = AppDataSource.getRepository(Transaction);

        // Fetch the user
        const user = await userRepo.findOne({ where: { id: userId, isBlocked: false, isVerified: true, isDeleted: false } });
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        // Fetch the cart with items and their plans
        const cart = await cartRepo.findOne({
            where: { user: { id: userId }, isCheckedOut: false, isDeleted: false, isError: false },
            relations: ["items", "items.plan"],
            order: { createdAt: "DESC" }
        });

        // // console.log("----- cart item ---", cart);

        if (!cart || cart.items.length === 0) {
            return res.status(404).json({ message: "Cart is empty" });
        }

        const validItems = cart.items.filter(
            item => !item.isDeleted && !item.plan?.isDeleted
        );

        const amount = validItems.reduce((total, item) => {
            const price = Number(item?.plan?.price ?? 0);
            const quantity = Number(item?.quantity ?? 0);
            return total + price * quantity;
        }, 0);

        const customer = await stripe.customers.create({
            name: (user?.firstName + user?.lastName).toString() || "N/A",
            email: user?.email || "N/A",
            phone: user?.phone || "N/A", // make sure this field exists in your DB
        });

        // Create a Stripe Payment Intent
        const paymentIntent = await stripe.paymentIntents.create({
            amount: Math.round(amount * 100), // Stripe expects cents
            currency: "usd",
            customer: customer?.id,
            metadata: { userId: user.id, cartId: cart.id },
        });

        // Save transaction to DB
        const transaction = new Transaction();
        transaction.user = user;
        transaction.cart = cart;
        transaction.paymentGateway = "stripe";
        transaction.transactionId = paymentIntent.id;
        transaction.amount = amount;
        transaction.status = "PENDING";

        await transactionRepo.save(transaction);

        return res.status(201).json({
            message: "Transaction created successfully",
            transaction,
            clientSecret: paymentIntent.client_secret, // send this to frontend
        });
    } catch (error: any) {
        console.error("Transaction Error:", error);
        return res.status(500).json({
            message: "Internal server error",
            error: error.message,
        });
    }
};

/**
 * Handle Stripe webhook
 */
export const handleStripeWebhook = async (req: any, res: Response) => {
    const sig = req.headers["stripe-signature"];
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET!;

    let event: Stripe.Event;

    try {
        event = stripe.webhooks.constructEvent(req.body, sig!, endpointSecret);
    } catch (err: any) {
        // ❌ Signature failed → still tell Stripe we received it
        console.error("Webhook signature error:", err.message);
        return res.status(200).send("INVALID_SIGNATURE_ACK");
    }

    try {
        const transactionRepo = AppDataSource.getRepository(Transaction);

        if (event.type === "payment_intent.succeeded") {
            const paymentIntent = event.data.object as Stripe.PaymentIntent;

            const transaction = await transactionRepo.findOne({
                where: { transactionId: paymentIntent.id },
            });

            if (!transaction) {
                console.warn("Transaction not found:", paymentIntent.id);
                return res.status(200).send("TX_NOT_FOUND_ACK");
            }

            if (transaction.source !== "WEB") {
                console.warn("Ignoring non-WEB transaction:", paymentIntent.id);
                return res.status(200).send("NON_WEB_ACK");
            }

            transaction.status = "SUCCESS";
            transaction.response = JSON.stringify(paymentIntent);
            await transactionRepo.save(transaction);
        }

        return res.status(200).json({ received: true });
    } catch (err) {
        // ❌ Internal error → still ACK Stripe
        console.error("Webhook processing error:", err);
        return res.status(200).send("PROCESSING_ERROR_ACK");
    }
};



/**
 * Get all transactions for a user
 */
export const getUserTransactions = async (req: any, res: Response) => {
    const userId = req.user.id;

    try {
        const transactionRepo = AppDataSource.getRepository(Transaction);
        const transactions = await transactionRepo.find({
            where: { user: { id: userId } },
            relations: ["cart", "cart.items", "cart.items.plan", "cart.items.plan.country"],
            order: { createdAt: "DESC" },
        });

        const response = transactions.map((tx) => ({
            id: tx.id,
            amount: tx.amount,
            status: tx.status,
            createdAt: tx.createdAt,
            cart: tx.cart
                ? {
                    id: tx.cart.id,
                    items: tx.cart.items
                        .filter((i) => !i.isDeleted)
                        .map((i) => ({
                            id: i.id,
                            plan: {
                                id: i.plan.id,
                                name: i.plan.name,
                                price: i.plan.price,
                                validityDays: i.plan.validityDays,
                                country: i.plan.country.name,
                            },
                            quantity: i.quantity,
                        })),
                }
                : null,
        }));

        res.json({ transactions: response });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: "Error fetching transactions" });
    }
};

export const handleCODTransaction = async (req: any, res: Response) => {
    // console.log("➡️ [COD] Request received:", req.body);

    const { cartId } = req.body;
    const userId = req.user?.id;

    if (!cartId || !userId) {
        return res.status(400).json({ message: "cartId and userId are required" });
    }

    try {
        const userRepo = AppDataSource.getRepository(User);
        const cartRepo = AppDataSource.getRepository(Cart);
        const transactionRepo = AppDataSource.getRepository(Transaction);

        // 1️⃣ Validate User
        const user = await userRepo.findOneBy({ id: userId });
        if (!user) return res.status(404).json({ message: "User not found" });

        // 2️⃣ Validate Cart
        const cart = await cartRepo.findOne({
            where: { id: cartId, user: { id: userId } },
            relations: ["items", "items.plan", "items.plan.country"],
        });

        if (!cart || cart.isCheckedOut || cart.isDeleted) {
            return res.status(400).json({ message: "Invalid or already checked-out cart" });
        }

        const validItems = cart.items.filter((i) => !i.isDeleted);
        if (!validItems.length) {
            return res.status(400).json({ message: "Cart has no valid items" });
        }

        // 3️⃣ Calculate Amount
        const amount = validItems.reduce(
            (sum, item) => sum + Number(item.plan.price) * item.quantity,
            0
        );

        // 4️⃣ Create COD transaction (SUCCESS)
        const transaction = transactionRepo.create({
            user,
            cart,
            amount,
            paymentGateway: "COD",
            transactionId: uuid(),       // UNIQUE ID
            status: TransactionStatus.SUCCESS,
        });

        await transactionRepo.save(transaction);

        // console.log("✅ [COD] Transaction created:", transaction.id);

        // 5️⃣ NOW HAND OVER EVERYTHING TO createOrderAfterPayment()
        const { order, summary } = await createOrderAfterPayment(transaction, userId);

        // console.log("🎉 COD Order Flow Completed:", order.id);

        return res.status(201).json({
            message: "COD Order created successfully",
            order,
            summary,
        });

    } catch (err: any) {
        console.error("🔥 COD Error:", err.message);
        return res.status(500).json({ message: "COD order failed", error: err.message });
    }
};

/**
 * Update transaction status
 * Can be called from frontend after successful Stripe payment
 */
export const handleTransactionStatus = async (req: any, res: Response) => {
    const { id } = req.params;

    try {
        const transactionRepo = AppDataSource.getRepository(Transaction);
        const transaction = await transactionRepo.findOne({ where: { id } });

        if (!transaction) {
            return res.status(404).json({ message: "Transaction not found" });
        }

        // Update status to success
        transaction.status = ("success").toUpperCase();
        await transactionRepo.save(transaction);

        return res.json({
            message: "Transaction updated successfully", transaction: {
                id: transaction?.id,
                amount: transaction?.amount,
                cart: transaction?.cart?.id,
                user: transaction?.user?.id
            }
        });
    } catch (err) {
        console.error("Failed to update transaction status:", err);
        return res.status(500).json({ message: "Server error" });
    }
};

export const initiateTopUpTransaction = async (req: any, res: Response) => {
    const userId = req.user?.id;
    const { topupId, esimId, paymentGateway } = req.body;

    if (!userId || !topupId || !esimId || !paymentGateway) {
        return res.status(400).json({ message: "Missing required fields" });
    }

    try {
        const userRepo = AppDataSource.getRepository(User);
        const esimRepo = AppDataSource.getRepository(Esim);
        const topUpRepo = AppDataSource.getRepository(TopUpPlan);
        const orderRepo = AppDataSource.getRepository(Order);
        const transactionRepo = AppDataSource.getRepository(Transaction);
        const esimTopUpRepo = AppDataSource.getRepository(EsimTopUp);

        // ✅ Validate user
        const user = await userRepo.findOne({ where: { id: userId } });
        if (!user) return res.status(404).json({ message: "User not found" });

        // ✅ Load eSIM with relations
        const esim = await esimRepo.findOne({
            where: { id: esimId, user: { id: userId } },
            relations: ["country", "plans", "topupLinks"],
        });
        if (!esim) return res.status(404).json({ message: "eSIM not found for user" });

        // ✅ Validate top-up plan
        const topupPlan = await topUpRepo.findOne({
            where: { id: topupId, isActive: true, isDeleted: false },
            relations: ["country"],
        });
        if (!topupPlan) return res.status(404).json({ message: "Top-up plan not found or inactive" });

        // ✅ Create transaction record
        const transaction = transactionRepo.create({
            user,
            esim,
            topupPlan,
            paymentGateway,
            amount: topupPlan.price || 0,
            transactionId: uuid(),
            status:
                paymentGateway === "cod"
                    ? TransactionStatus.SUCCESS
                    : TransactionStatus.PENDING,
        });

        await transactionRepo.save(transaction);

        // ✅ Handle COD top-up (instant apply)
        if (paymentGateway === "cod") {
            esim.dataAmount = (esim.dataAmount || 0) + (topupPlan.dataLimit || 0);
            esim.validityDays = Math.max(
                esim.validityDays || 0,
                topupPlan.validityDays || 0
            );

            const esimTopUp = esimTopUpRepo.create({
                esim,
                topup: topupPlan, // ✅ correct property name
                order: null,      // optional for COD
            });

            await esimTopUpRepo.save(esimTopUp);

            await esimRepo.save(esim);

            return res.status(201).json({
                message: "COD Top-up successful",
                transaction,
                updatedEsim: esim,
            });
        }

        // ✅ Handle Stripe top-up (deferred apply)
        if (paymentGateway === "stripe") {
            const paymentIntent = await stripe.paymentIntents.create({
                amount: Math.round((topupPlan.price || 0) * 100),
                currency: (topupPlan.currency || "USD").toLowerCase(),
                metadata: { userId, topupId, esimId, transactionId: transaction.id },
            });

            transaction.transactionId = paymentIntent.id;
            await transactionRepo.save(transaction);

            return res.status(201).json({
                message: "Stripe top-up initiated",
                transaction,
                clientSecret: paymentIntent.client_secret,
            });
        }

        // ❌ Unsupported gateway fallback
        return res.status(400).json({ message: "Unsupported payment gateway" });

    } catch (err: any) {
        console.error("TopUp Transaction Error:", err);
        return res.status(500).json({
            message: "Internal server error",
            error: err.message,
        });
    }
};

export const createOrderByMobile = async (req: any, res: Response) => {
    const transactionRepo = AppDataSource.getRepository(Transaction);
    // const cartRepo = AppDataSource.getRepository(Cart);

    const { id, role } = req.user
    if (!id && role === "user") {
        return res.status(403).json({ message: "Forbidden" });
    }

    try {
        const transactionId = req.params.id;

        if (!transactionId) {
            return res.status(400).json({ message: "Transaction ID is required" });
        }

        // 1️⃣ Fetch transaction (single source of truth)
        const transaction = await transactionRepo.findOne({
            where: { id: transactionId },
            relations: [
                "user",
                "cart",
                "cart.items",
                "cart.items.plan",
                "cart.items.plan.country",
                "topupPlan",
            ],
        });

        if (!transaction) {
            return res.status(404).json({ message: "Transaction not found" });
        }

        // console.log("-=-=--=-= transaction -=-=-==-=",transaction);

        if (transaction.source !== "MOBILE") {
            return res.status(400).json({ message: "Invalid transaction source" });
        }

        // if (transaction.isPaypalOrderConfirmed) {
        //     return res.status(400).json({
        //         message: "Payment already confirmed",
        //     });
        // }

        if (transaction?.cart) {
            if (transaction?.cart?.isCheckedOut) {
                return res.status(400).json({ message: "Transaction already checked out" });
            }

            if (transaction?.cart?.isDeleted) {
                return res.status(400).json({ message: "Cart has been deleted" });
            }

            if (transaction?.cart?.isError) {
                return res.status(400).json({ message: "Transaction has errors" });
            }
        }


        if (transaction.status === TransactionStatus.SUCCESS) {
            console.log("✅ Transaction already marked as SUCCESS:", transactionId);
        } else if (transaction.paymentGateway === "PAYPAL") {
            console.log("🔍 Verifying PayPal transaction:", transaction.transactionId);
            try {
                // 1️⃣ Fetch order status from PayPal
                const getRequest = new paypal.orders.OrdersGetRequest(transaction.transactionId);
                const orderDetails = await paypalClient.execute(getRequest);
                const paypalStatus = orderDetails.result.status;

                console.log("ℹ️ PayPal order status:", paypalStatus);

                if (paypalStatus === "APPROVED") {
                    // 2️⃣ Capture the payment if approved but not yet captured
                    console.log("💰 Capturing PayPal order:", transaction.transactionId);
                    const captureRequest: any = new paypal.orders.OrdersCaptureRequest(transaction.transactionId);
                    captureRequest.requestBody({ payment_source: {} });
                    const captureResponse = await paypalClient.execute(captureRequest);

                    if (captureResponse.result.status !== "COMPLETED") {
                        return res.status(400).json({
                            success: false,
                            message: `Failed to capture PayPal payment. Current status: ${captureResponse.result.status}`,
                        });
                    }
                    transaction.status = TransactionStatus.SUCCESS;
                } else if (paypalStatus === "COMPLETED") {
                    transaction.status = TransactionStatus.SUCCESS;
                } else {
                    return res.status(400).json({
                        success: false,
                        message: `PayPal payment not ready. Current status: ${paypalStatus}`,
                    });
                }
            } catch (payError: any) {
                console.error("❌ PayPal verification error:", payError);
                return res.status(500).json({
                    success: false,
                    message: "Failed to verify PayPal payment status",
                    error: payError.message,
                });
            }
        } else {
            // For other gateways (like Stripe), we might rely on webhooks, 
            // but for polling it should already be SUCCESS if handled correctly.
            if (transaction.status !== TransactionStatus.SUCCESS) {
                return res.status(400).json({
                    success: false,
                    message: "Transaction is not successful yet",
                });
            }
        }

        transaction.isPaypalOrderConfirmed = true;
        await transactionRepo.save(transaction);

        // 2️⃣ Route to correct flow
        if (transaction.topupPlan) {
            // 🔹 MOBILE TOP-UP FLOW
            const result = await processMobileTopUp({
                transactionId: transaction.transactionId,
            });

            console.log("🔹 Mobile Top-Up Result:", result);

            if (!result.success) {
                return res.status(400).json({
                    success: false,
                    message: result.message,
                });
            }

            return res.status(200).json({
                success: true,
                message: "Top-up successful",
                data: result.order,
            });
        }

        // 🔹 NORMAL eSIM PURCHASE FLOW
        const result = await createOrderAfterPayment(
            { ...transaction, cart: transaction.cart },
            id
        );

        if (result.isExists) {
            return res.status(200).json({
                success: true,
                message: "Order already exists",
                data: result,
            });
        }

        return res.status(200).json({
            success: true,
            message: "Order created successfully",
            data: result,
        });

    } catch (err: any) {
        console.error("❌ [createOrderByMobile] Error:", err.message);

        return res.status(500).json({
            success: false,
            message: "Failed to process mobile order",
            error: err.message,
        });
    }
};
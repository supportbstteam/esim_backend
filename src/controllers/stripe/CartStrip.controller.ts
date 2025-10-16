import { Request, Response } from "express";
import { AppDataSource } from "../../data-source";
import Stripe from "stripe";
import { Cart } from "../../entity/Carts.entity";
import { User } from "../../entity/User.entity";
import { Esim } from "../../entity/Esim.entity";
import { Transaction, TransactionStatus } from "../../entity/Transactions.entity";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
    apiVersion: "2025-09-30.clover",
});

export const initiateTransaction = async (req: any, res: Response) => {
    const userId = req.user.id;

    try {
        const userRepo = AppDataSource.getRepository(User);
        const cartRepo = AppDataSource.getRepository(Cart);
        const transactionRepo = AppDataSource.getRepository(Transaction);

        // Fetch the user
        const user = await userRepo.findOne({ where: { id: userId } });
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        // Fetch the cart with items and their plans
        const cart = await cartRepo.findOne({
            where: { user: { id: userId }, isCheckedOut: false },
            relations: ["items", "items.plan"],
        });

        if (!cart || cart.items.length === 0) {
            return res.status(404).json({ message: "Cart is empty" });
        }

        // Calculate total amount
        const amount = cart.items.reduce((total, item) => {
            const price = Number(item?.plan?.price ?? 0);      // ensure price is a number
            const quantity = Number(item?.quantity ?? 0);      // ensure quantity is a number
            return total + price * quantity;
        }, 0);



        // Create a Stripe Payment Intent
        const paymentIntent = await stripe.paymentIntents.create({
            amount: Math.round(amount * 100), // Stripe expects cents
            currency: "usd",
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
export const handleStripeWebhook = async (req: Request, res: Response) => {
    const sig = req.headers["stripe-signature"];
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET || "";

    let event: Stripe.Event;
    try {
        event = stripe.webhooks.constructEvent(req.body, sig!, endpointSecret);
    } catch (err: any) {
        console.error("Stripe webhook signature verification failed:", err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    const transactionRepo = AppDataSource.getRepository(Transaction);
    const esimRepo = AppDataSource.getRepository(Esim);
    const cartRepo = AppDataSource.getRepository(Cart);

    if (event.type === "payment_intent.succeeded") {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;

        const transaction = await transactionRepo.findOne({
            where: { transactionId: paymentIntent.id },
            relations: ["cart", "cart.items", "cart.items.plan", "cart.items.plan.country", "user"],
        });

        if (!transaction) return res.status(404).send("Transaction not found");

        transaction.status = TransactionStatus.SUCCESS;
        transaction.response = JSON.stringify(paymentIntent);
        await transactionRepo.save(transaction);

        for (const item of transaction.cart.items) {
            for (let i = 0; i < item.quantity; i++) {
                const esim = esimRepo.create({
                    user: { id: transaction.user.id },
                    plans: [item.plan],
                    country: item.plan.country,
                    isActive: true,
                });
                await esimRepo.save(esim);
            }
        }

        transaction.cart.isCheckedOut = true;
        await cartRepo.save(transaction.cart);

        return res.json({ received: true });
    }

    res.json({ received: true });
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
            cart: {
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
            },
        }));

        res.json({ transactions: response });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: "Error fetching transactions" });
    }
};

export const handleCODTransaction = async (req: any, res: Response) => {
    const userId = req.user.id;

    try {
        const userRepo = AppDataSource.getRepository(User);
        const cartRepo = AppDataSource.getRepository(Cart);
        const transactionRepo = AppDataSource.getRepository(Transaction);
        const esimRepo = AppDataSource.getRepository(Esim);

        const user = await userRepo.findOne({ where: { id: userId } });
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        const cart = await cartRepo.findOne({
            where: { user: { id: userId }, isCheckedOut: false },
            relations: ["items", "items.plan", "items.plan.country"],
        });

        if (!cart) {
            return res.status(404).json({ message: "Cart not found" });
        }

        // Calculate total amount from cart
        const amount = cart.items.reduce(
            (total, item) => total + parseFloat(item.plan.price) * item.quantity,
            0
        );

        // Create a COD transaction
        const transaction = new Transaction();
        transaction.user = { id: user.id } as User;
        transaction.cart = { id: cart.id } as Cart;
        transaction.paymentGateway = "cod";
        transaction.transactionId = `cod_${Date.now()}`; // unique id for COD
        transaction.amount = amount;
        transaction.status = TransactionStatus.SUCCESS; // COD is treated as immediate success

        await transactionRepo.save(transaction);

        // Create ESIMs immediately (same as Stripe success flow)
        for (const item of cart.items) {
            for (let i = 0; i < item.quantity; i++) {
                const esim = esimRepo.create({
                    user: { id: user.id },
                    plans: [item.plan],
                    country: item.plan.country,
                    isActive: true,
                });
                await esimRepo.save(esim);
            }
        }

        // Mark cart as checked out
        cart.isCheckedOut = true;
        await cartRepo.save(cart);

        return res.status(201).json({
            message: "COD transaction completed successfully",
            transaction,
        });
    } catch (error: any) {
        console.error("COD Transaction Error:", error);
        return res.status(500).json({
            message: "Internal server error",
            error: error.message,
        });
    }
};

/**
 * Update transaction status
 * Can be called from frontend after successful Stripe payment
 */
export const handleTransactionStatus = async (req: Request, res: Response) => {
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
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

export const postOrder = async (req: any, res: Response) => {
    const { planId } = req.body;
    const { id: userId } = req.user;
    const thirdPartyToken = { Authorization: `Bearer ${req.thirdPartyToken}` };

    let transaction: Transaction | null = null;
    let order: Order | null = null;
    let reservation: Reservation | null = null;
    let esim: Esim | null = null;

    try {
        console.log("📌 Starting postOrder process", { userId, planId });

        if (!userId || !planId) {
            console.log("❌ Missing userId or planId");
            return res.status(400).json({ message: "userId and planId are required", status: "error" });
        }

        const dataSource = await getDataSource();
        const userRepo = dataSource.getRepository(User);
        const planRepo = dataSource.getRepository(Plan);
        const transactionRepo = dataSource.getRepository(Transaction);
        const orderRepo = dataSource.getRepository(Order);
        const chargeRepo = dataSource.getRepository(Charges);
        const reserveRepo = dataSource.getRepository(Reservation);
        const esimRepo = dataSource.getRepository(Esim);

        // Fetch User
        const user = await userRepo.findOne({ where: { id: userId, isDeleted: false } });
        console.log("👤 Fetched user", user?.id);
        if (!user) throw new Error("User not found");

        // Fetch Plan
        const plan = await planRepo.findOne({
            where: { id: planId, isDeleted: false, isActive: true },
            relations: ["country"],
        });
        console.log("📦 Fetched plan", plan?.id);
        if (!plan) throw new Error("Plan not found");

        const country = plan.country as Country;
        if (!country) throw new Error("Plan does not have an assigned country");
        // console.log("🌍 Country assigned", country.id);

        // Create Fake Transaction
        const fakeTransactionId = `FAKE-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
        transaction = transactionRepo.create({
            user,
            plan,
            paymentGateway: "FakeGateway",
            transactionId: fakeTransactionId,
            amount: Number(plan.price) || 0,
            status: "success",
            response: JSON.stringify({ message: "Simulated transaction success" }),
        });
        await transactionRepo.save(transaction);
        // console.log("💰 Transaction created", { id: transaction.id, transactionId: transaction.transactionId });

        // Create Charges linked to Transaction
        const charge1 = chargeRepo.create({ name: "Service Fee", amount: 10, transaction, isActive: true });
        const charge2 = chargeRepo.create({ name: "Activation Fee", amount: 5, transaction, isActive: true });
        await chargeRepo.save([charge1, charge2]);
        // console.log("🧾 Charges created", charge1.id, charge2.id);

        // Create Order linked to Transaction
        order = orderRepo.create({
            user,
            plan,
            country,
            transaction,
            totalAmount: Number(plan.price),
            status: "pending",
            activated: false,
        });
        await orderRepo.save(order);
        // console.log("📄 Order created", order.id);

        console.log("---- esim plan id ----", plan.planId);
        // Reserve eSIM
        const reserveResponse = await axios.get(
            `${process.env.TURISM_URL}/v2/sims/reserve?product_plan_id=${plan.planId}`,
            { headers: thirdPartyToken }
        );

        if (reserveResponse.data?.status !== "success") {
            throw new Error(reserveResponse.data?.message || "Reservation failed");
        }

        console.log("----- reserveResponse ----", reserveResponse?.data);

        const externalReserveId = reserveResponse.data.data?.id;
        if (!externalReserveId) throw new Error("Reservation returned invalid ID");

        console.log("---- reservation id externalReserveId ----", externalReserveId);

        reservation = reserveRepo.create({ reserveId: externalReserveId, plan, country, user, order });
        await reserveRepo.save(reservation);
        console.log("🎫 Reservation created", reservation.id, "External ID:", reservation.reserveId);

        // Create eSIM
        const createSimResponse = await axios.post(
            `${process.env.TURISM_URL}/v2/sims/${reservation.reserveId}/purchase`,
            {},
            { headers: thirdPartyToken }
        );

        // Create eSIM from 3rd party response
        const esimData = createSimResponse.data?.data;
        if (!esimData) throw new Error("Failed to create eSIM");

        console.log("---- esim data ----", esimData);

        esim = esimRepo.create({
            externalId: esimData.id?.toString(),
            iccid: esimData.iccid || null,
            qrCodeUrl: esimData.qr_code_url || null,
            networkStatus: esimData.network_status || null,
            statusText: esimData.status_text || null,
            productName: esimData.name || null,
            currency: esimData.currency || null,
            price: parseFloat(esimData.price) || 0,
            validityDays: esimData.validity_days || null,
            dataAmount: esimData.data || 0,
            callAmount: esimData.call || 0,
            smsAmount: esimData.sms || 0,
            isActive: esimData.network_status !== "NOT_ACTIVE",
            startDate: new Date(),
            endDate: new Date(new Date().setDate(new Date().getDate() + (esimData.validity_days || 30))),
            country,
            user,
            plans: [plan],
        });

        await esimRepo.save(esim);
        console.log("📶 eSIM created and stored", esim.id);

        // Update Order
        order.esim = esim;
        order.status = "completed";
        order.activated = true;
        await orderRepo.save(order);
        console.log("✅ Order updated with eSIM", order.id, "status:", order.status);

        return res.status(201).json({
            message: "Transaction, Charges, Order, and eSIM created successfully",
            status: "success",
            data: { transaction, order, charges: [charge1, charge2], reservation, esim },
        });

    } catch (err: any) {
        console.error("❌ Error in postOrder:", err.response?.data || err.message);

        if (order) {
            order.status = "failed";
            order.errorMessage = err.response?.data?.message || err.message;
            const dataSource = await getDataSource();
            const orderRepo = dataSource.getRepository(Order);
            await orderRepo.save(order);
            console.log("⚠️ Order marked as failed", order.id);
        }

        return res.status(500).json({ message: "Order process failed", error: err.message });
    }
};

// fake generator esim 
// export const generateFakeOrder = async (req: any, res: Response) => {
//     const { id: userId } = req.user;
//     const { planId } = req.body;

//     if (!userId || !planId) {
//         return res.status(400).json({
//             message: "userId and planId are required",
//             status: "error",
//         });
//     }

//     let transaction: Transaction | null = null;
//     let order: Order | null = null;
//     let reservation: Reservation | null = null;
//     let esim: Esim | null = null;

//     try {
//         console.log("🧪 Starting fake order generation for dev mode", { userId, planId });

//         const dataSource = await getDataSource();
//         const userRepo = dataSource.getRepository(User);
//         const planRepo = dataSource.getRepository(Plan);
//         const transactionRepo = dataSource.getRepository(Transaction);
//         const orderRepo = dataSource.getRepository(Order);
//         const chargeRepo = dataSource.getRepository(Charges);
//         const reserveRepo = dataSource.getRepository(Reservation);
//         const esimRepo = dataSource.getRepository(Esim);

//         // ✅ Fetch existing user
//         const user = await userRepo.findOne({ where: { id: userId, isDeleted: false } });
//         if (!user) {
//             return res.status(404).json({ message: "User not found", status: "error" });
//         }

//         // ✅ Fetch existing plan (with country)
//         const plan = await planRepo.findOne({
//             where: { id: planId, isDeleted: false, isActive: true },
//             relations: ["country"],
//         });
//         if (!plan) {
//             return res.status(404).json({ message: "Plan not found", status: "error" });
//         }

//         const country = plan.country as Country;
//         if (!country) {
//             return res.status(400).json({ message: "Plan does not have an assigned country", status: "error" });
//         }

//         // ✅ Create Fake Transaction
//         const fakeTransactionId = `FAKE-DEV-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
//         transaction = transactionRepo.create({
//             user,
//             plan,
//             paymentGateway: "DevGateway",
//             transactionId: fakeTransactionId,
//             amount: Number(plan.price),
//             status: "success",
//             response: JSON.stringify({ message: "Simulated Dev Transaction" }),
//         });
//         await transactionRepo.save(transaction);
//         console.log("💰 Fake transaction created", transaction.id);

//         // ✅ Create Fake Charges
//         const charge1 = chargeRepo.create({ name: "Service Fee", amount: 10, transaction, isActive: true });
//         const charge2 = chargeRepo.create({ name: "Activation Fee", amount: 5, transaction, isActive: true });
//         await chargeRepo.save([charge1, charge2]);
//         console.log("🧾 Fake charges created!");

//         // ✅ Create Fake Reservation
//         const fakeReserveId = `DEV-RES-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
//         reservation = reserveRepo.create({
//             reserveId: fakeReserveId,
//             plan,
//             country,
//             user,
//         });
//         await reserveRepo.save(reservation);
//         console.log("🎫 Fake reservation created", reservation.id);

//         // ✅ Create Fake eSIM
//         const fakeSimNumber = `DEV-SIM-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
//         esim = esimRepo.create({
//             // simNumber: fakeSimNumber,
//             country,
//             user,
//             plans: [plan],
//             isActive: true,
//             startDate: new Date(),
//             endDate: new Date(new Date().setDate(new Date().getDate() + plan.validityDays)),
//         });
//         await esimRepo.save(esim);
//         console.log("📶 Fake eSIM created", esim.id);

//         // ✅ Create Fake Order
//         order = orderRepo.create({
//             user,
//             plan,
//             country,
//             transaction,
//             totalAmount: Number(plan.price),
//             status: "completed",
//             activated: true,
//             esim,
//         });
//         await orderRepo.save(order);
//         console.log("📄 Fake order created", order.id);

//         return res.status(201).json({
//             message: "✅ Fake order generated successfully (Dev Mode)",
//             status: "success",
//             data: {
//                 transaction,
//                 order,
//                 charges: [charge1, charge2],
//                 reservation,
//                 esim,
//             },
//         });
//     } catch (err: any) {
//         console.error("❌ Error generating fake order:", err.message);
//         if (order) {
//             order.status = "failed";
//             order.errorMessage = err.message;
//             const dataSource = await getDataSource();
//             const orderRepo = dataSource.getRepository(Order);
//             await orderRepo.save(order);
//             console.log("⚠️ Order marked as failed", order.id);
//         }

//         return res.status(500).json({
//             message: "Failed to generate fake order (Dev Mode)",
//             error: err.message,
//         });
//     }
// };

export const getOrderListByUser = async (req: any, res: Response) => {
    const { id, role } = req.user;

    if (!id || role !== "user") {
        return res.status(401).json({ message: "Unauthorized User", status: "error" });
    }

    try {
        const dataSource = await getDataSource();
        const orderRepo = dataSource.getRepository(Order);

        const orders = await orderRepo.find({
            where: { user: { id } },
            relations: [
                "plan",
                "esim",
                "country",
                "transaction",
                "transaction.plan",
                "transaction.user",
                "transaction.charges",
            ],
            order: { createdAt: "DESC" },
        });

        // Map orders to simplified response to handle preciously
        const formattedOrders = orders.map((order) => ({
            id: order.id,
            title: order.plan?.title || "",
            planName: order.plan?.name || "",
            data: order.plan?.data || "",
            validityDays: order.plan?.validityDays || 0,
            price: order.totalAmount || "",
            country: order.country?.name || "",
            isoCode: order.country?.isoCode || "",
            phoneCode: order.country?.phoneCode || "",
            isActive: order.activated,
            status: order.status,
            errorMessage: order.errorMessage,
        }));

        return res.status(200).json({
            message: "Orders fetched successfully",
            status: "success",
            data: formattedOrders,
        });
    } catch (err: any) {
        console.error("Error fetching orders:", err);
        return res.status(500).json({
            message: "Failed to fetch orders",
            status: "error",
            error: err.message,
        });
    }
};

export const getOrderDetailsByUser = async (req: any, res: Response) => {
    const { id, role } = req.user;
    const { orderId } = req.params;

    if (!id || role !== "user") {
        return res.status(401).json({ message: "Unauthorized User", status: "error" });
    }

    if (!orderId) {
        return res.status(400).json({ message: "Order ID is required", status: "error" });
    }

    try {
        const dataSource = await getDataSource();
        const orderRepo = dataSource.getRepository(Order);

        const order = await orderRepo.findOne({
            where: { id: orderId, user: { id } },
            relations: [
                "plan",
                "esim",
                "country",
                "transaction",
                "transaction.plan",
                "transaction.user",
                "transaction.charges",
            ],
        });

        if (!order) return res.status(404).json({ message: "Order not found", status: "error" });

        return res.status(200).json({ message: "Order details fetched successfully", status: "success", data: order });
    } catch (err: any) {
        console.error("Error fetching order details:", err);
        return res.status(500).json({ message: "Failed to fetch order details", status: "error", error: err.message });
    }
};

export const postReserveEsim = async (req: any, res: Response) => {
    const { id: userId } = req.user; // user info from auth middleware

    try {

        if (!userId) {
            return res.status(400).json({ message: "userId is required" });
        }

        const { planId } = req.body;
        if (!planId) {
            return res.status(400).json({ message: "planId is required" });
        }

        const dataSource = await getDataSource();
        const planRepo = dataSource.getRepository(Plan);
        const reserveRepo = dataSource.getRepository(Reservation);
        const userRepo = dataSource.getRepository(User);

        // 🔍 find plan in DB
        const plan = await planRepo.findOne({
            where: { id: planId, isDeleted: false, isActive: true },
            relations: ["country"]
        });

        // ✅ Verify user exists in DB
        const user = await userRepo.findOne({ where: { id: userId, isDeleted: false } });
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        if (!plan) {
            return res.status(404).json({ message: "Plan not found" });
        }

        console.log(
            "---- url for third party api -----",
            `${process.env.TURISM_URL}/v2/sims/reserve?product_plan_id=${plan?.planId}`
        );

        // 📡 Call external API for reservation
        const apiResponse: any = await axios.get(
            `${process.env.TURISM_URL}/v2/sims/reserve?product_plan_id=${plan?.planId}`,
            {
                headers: {
                    Authorization: `Bearer ${req.thirdPartyToken}`
                }
            }
        );

        if (apiResponse?.data?.status === "success") {
            const externalReserveId = apiResponse.data.data?.id;

            // ✅ Save Reservation in DB
            const reservation = reserveRepo.create({
                reserveId: externalReserveId,
                plan: { id: planId } as Plan,
                country: { id: plan?.country?.id } as Country,
                user: { id: userId } as any // minimal user ref
            });

            await reserveRepo.save(reservation);

            return res.status(201).json({
                message: "E-sim reserved successfully",
                data: {
                    reservation,
                    externalResponse: apiResponse.data
                }
            });
        } else if (apiResponse?.data?.status === "error") {
            return res.status(400).json({
                message: "Reservation failed with provider",
                error: apiResponse.data?.message || "Unknown error"
            });
        } else {
            return res.status(500).json({
                message: "Unexpected response from provider",
                response: apiResponse.data
            });
        }
    } catch (err: any) {
        // ✅ Handle axios errors separately
        if (err.response) {
            const status = err.response.status;
            const providerMessage = err.response.data?.message || "Provider error";

            if (status === 404) {
                return res.status(404).json({
                    message: "Reservation not found from provider",
                    error: providerMessage
                });
            }

            // For other known provider errors
            return res.status(status).json({
                message: "Error from provider",
                error: providerMessage
            });
        }

        // Fallback: unexpected errors
        console.error("Error in the E-sim reservation", err.message || err);
        return res.status(500).json({ message: "Internal server error", error: err.message });
    }
};

export const postTransaction = async (req: any, res: Response) => {

}

export const postCreateSim = async (req: any, res: Response) => {

    const { reverseId } = req.body;
    try {
        const apiResponse: any = await axios.get(
            `${process.env.TURISM_URL}/v2/sims/${reverseId}/purchase`,
            {
                headers: {
                    Authorization: `Bearer ${req.thirdPartyToken}`
                }
            }
        );

        console.log("---- api response in the post creating sim ----", apiResponse);
    }
    catch (err) {
        console.error("Error in the creating Esim:", err);

    }
}
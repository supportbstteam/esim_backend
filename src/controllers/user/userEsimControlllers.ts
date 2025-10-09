import { Response } from "express";
import { Plan } from "../../entity/Plans.entity";
import { getDataSource } from "../../lib/serverless";
import axios from "axios";
import { Reservation } from "../../entity/Reservation.entity";
import { Country } from "../../entity/Country.entity";
import { User } from "../../entity/User.entity";
import { Order } from "../../entity/order.entity";
import { Esim } from "../../entity/Esim.entity";

export const postOrder = async (req: any, res: Response) => {
    const { planId, transactionId } = req.body;
    const { id: userId } = req.user;

    const thirdPartyToken = { Authorization: `Bearer ${req.thirdPartyToken}` };
    let reservation: any= null; // 👈 to access in catch block

    try {
        console.log("🔹 Starting postOrder process");

        if (!userId || !planId) {
            console.log("❌ Missing userId or planId or transactionId");
            return res.status(400).json({ message: "userId, planId and transactionId are required" });
        }

        const dataSource = await getDataSource();
        const userRepo = dataSource.getRepository(User);
        const planRepo = dataSource.getRepository(Plan);
        const orderRepo = dataSource.getRepository(Order);
        const reserveRepo = dataSource.getRepository(Reservation);
        const esimRepo = dataSource.getRepository(Esim);

        console.log("🔹 Fetching User and Plan");
        const user = await userRepo.findOne({ where: { id: userId, isDeleted: false } });
        if (!user) return res.status(404).json({ message: "User not found" });

        const plan = await planRepo.findOne({
            where: { id: planId, isDeleted: false, isActive: true },
            relations: ["country"],
        });
        if (!plan) return res.status(404).json({ message: "Plan not found" });

        const country = plan.country as Country;
        if (!country) return res.status(400).json({ message: "Plan does not have a country assigned" });

        console.log("🔹 Creating Order in DB");
        const order = orderRepo.create({
            user: { id: user.id },
            plan: { id: plan.id },
            country: { id: country.id },
            totalAmount: plan.price.toString(),
            status: "pending",
            activated: false,
        });
        await orderRepo.save(order);
        console.log("✅ Order created:", order.id);

        // 🔹 Reserve eSIM
        console.log("🔹 Reserving eSIM via third-party API (Plan ID)", plan.planId);
        const reserveResponse = await axios.get(
            `${process.env.TURISM_URL}/v2/sims/reserve?product_plan_id=${plan.planId}`,
            { headers: thirdPartyToken }
        );

        if (reserveResponse.data?.status !== "success") {
            throw new Error(reserveResponse.data?.message || "Reservation failed");
        }

        const externalReserveId = reserveResponse.data.data?.id;
        if (!externalReserveId) throw new Error("Reservation returned invalid ID");

        console.log("🔹 Saving Reservation in DB");
        reservation = reserveRepo.create({
            reserveId: externalReserveId,
            plan: { id: plan.id },
            country: { id: country.id },
            user: { id: user.id },
        });
        await reserveRepo.save(reservation);
        console.log("✅ Reservation saved:", reservation.id);

        // 🔹 Create eSIM
        console.log("🔹 Creating eSIM using Reservation ID from DB");
        const createSimResponse = await axios.post(
            `${process.env.TURISM_URL}/v2/sims/${reservation.reserveId}/purchase`,
            {},
            { headers: thirdPartyToken }
        );

        const esimData = createSimResponse.data?.data;
        if (!esimData) throw new Error("Failed to create eSIM");

        console.log("🔹 Saving eSIM in DB");
        const esim = esimRepo.create({
            simNumber: esimData.sim_number || `ESIM-${Date.now()}`,
            country: { id: country.id },
            user: { id: user.id },
            plans: [plan],
            isActive: true,
            startDate: new Date(),
            endDate: new Date(new Date().setMonth(new Date().getMonth() + 1)),
        });
        await esimRepo.save(esim);

        console.log("🔹 Updating Order with eSIM info");
        order.esim = esim;
        order.status = "completed";
        order.activated = true;
        order.activationDate = new Date();
        await orderRepo.save(order);

        return res.status(201).json({
            message: "Order created, eSIM reserved and activated successfully",
            data: { order, reservation, esim, createSimResponse: createSimResponse.data },
        });

    } catch (err: any) {
        console.error("❌ Error in postOrder:", err.response?.data || err.message || err);

        // 🧷 Save error message in reservation if already created
        try {
            if (reservation) {
                const dataSource = await getDataSource();
                const reserveRepo = dataSource.getRepository(Reservation);
                reservation.error = err.response?.data?.message || err.message || "Unknown error";
                await reserveRepo.save(reservation);
                console.log("💾 Saved error message in reservation:", reservation.error);
            }
        } catch (saveErr) {
            console.error("⚠️ Failed to save error in reservation:", saveErr);
        }

        return res.status(500).json({ message: "Internal server error", error: err.message });
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
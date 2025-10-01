import { Response } from "express";
import { Plan } from "../../entity/Plans.entity";
import { getDataSource } from "../../lib/serverless";
import axios from "axios";
import { Reservation } from "../../entity/Reservation.entity";
import { Country } from "../../entity/Country.entity";
import { User } from "../../entity/User.entity";

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

}
import { Response } from "express";
import { CartItem } from "../../entity/CartItem.entity";
import { Cart } from "../../entity/Carts.entity";
import { TopUpPlan } from "../../entity/Topup.entity";
import { AppDataSource } from "../../data-source";
import { Esim } from "../../entity/Esim.entity";

export const postUserTopUpOrder = async (req: any, res: Response) => {
    const { id } = req.user?.id;
    try {

    }
    catch (err) {

    }
}

export const getUserTopUpOrderList = async () => {

}

export const getUserTopUpOrderListById = async () => {

}

export const getUserTopUpPlans = async (req: any, res: Response) => {
    const { id, role } = req.user;
    if (role !== 'user') {
        return res.status(403).json({ status: false, message: "Forbidden" });
    }

    if (!id) {
        return res.status(401).json({ status: false, message: "Unauthorized" });
    }

    const { simId } = req.query;

    if (!simId || typeof simId !== "string") {
        return res.status(400).json({ status: false, message: "SIM ID is required" });
    }

    try {
        const esimRepo = AppDataSource.getRepository(Esim);
        const topupRepo = AppDataSource.getRepository(TopUpPlan);

        // 1️⃣ Fetch the eSIM to get its country
        const esim = await esimRepo.findOne({
            where: { id: simId },
            relations: ["country"],
        });

        if (!esim) {
            return res.status(404).json({ status: false, message: "eSIM not found" });
        }

        const countryId = esim.country.id;

        // 2️⃣ Fetch all active top-up plans for this country
        const topUpPlans = await topupRepo.find({
            where: { isActive: true, country: { id: countryId } },
            order: { price: "ASC" }, // optional: sort by price
        });

        return res.status(200).json({
            status: true,
            data: topUpPlans,
            esim
        });
    } catch (err: any) {
        console.error("Error fetching top-up plans:", err);
        return res.status(500).json({ status: false, message: "Internal Server Error" });
    }
};
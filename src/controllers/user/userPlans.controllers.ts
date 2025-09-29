import { Plan } from "../../entity/Plans";
import { getDataSource } from "../../lib/serverless";

export const getUserPlans = async (req: any, res: any) => {
    try {
        const { countryId } = req.query;
        if (!countryId) {
            return res.status(400).json({ message: "countryId is required" });
        }

        const dataSource = await getDataSource();
        const planRepo = dataSource.getRepository(Plan);

        const plans = await planRepo.find({
            where: {
                country: { id: countryId as string },
                isDeleted: false, // don’t show deleted plans
            },
            relations: ["country"], // fetch country data too
            order: { price: "ASC" }, // optional: sort plans by price
        });

        if (plans.length === 0) {
            return res.status(404).json({ message: "No plans found for this country" });
        }

        res.status(200).json(plans);
    } catch (error) {
        console.error("Error fetching plans:", error);
        res.status(500).json({ message: "Server error", error });
    }
};
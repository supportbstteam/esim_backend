import { Response, Request } from "express";
import { Country } from "../../entity/Country.entity";
import { getDataSource } from "../../lib/serverless";
import { Plan } from "../../entity/Plans.entity";

export const getCountryUser = async (_req: Request, res: Response) => {
    try {
        const dataSource = await getDataSource();
        const countryRepository = dataSource.getRepository(Country);
        const planRepository = dataSource.getRepository(Plan);

        // Fetch all active and non-deleted countries
        const countries = await countryRepository.find({
            where: { isActive: true, isDelete: false },
            order: { name: "ASC" },
        });

        // Fetch lowest price plan for each country
        const lowestPrices = await planRepository
            .createQueryBuilder("plan")
            .select("plan.countryId", "countryId")
            .addSelect("MIN(plan.price)", "minPrice")
            .groupBy("plan.countryId")
            .getRawMany();

        // Create a map for quick lookup
        const priceMap = new Map(
            lowestPrices.map((p) => [p.countryId, Number(p.minPrice)])
        );

        // Attach lowest price to each country
        const result = countries.map((country) => ({
            ...country,
            price: priceMap.get(country.id) || null, // null if no plan found
        }));

        return res.status(200).json({
            success: true,
            data: result,
        });
    } catch (err: any) {
        console.error("Error fetching countries:", err);
        return res
            .status(500)
            .json({ success: false, message: "Server error" });
    }
};
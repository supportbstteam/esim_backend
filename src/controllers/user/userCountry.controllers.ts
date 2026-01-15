import { Response, Request } from "express";
import { Country } from "../../entity/Country.entity";
import { getDataSource } from "../../lib/serverless";
import { Plan } from "../../entity/Plans.entity";

export const getCountryUser = async (_req: Request, res: Response) => {
    try {
        const dataSource = await getDataSource();
        const countryRepo = dataSource.getRepository(Country);

        const result = await countryRepo
            .createQueryBuilder("country")
            .leftJoin(
                Plan,
                "plan",
                "plan.countryId = country.id AND plan.isActive = true AND plan.isDeleted = false"
            )
            .select([
                "country.id AS id",
                "country.name AS name",
                "country.isoCode AS isoCode",
                "country.iso3Code AS iso3Code",
                "country.imageUrl AS imageUrl",
                "country.phoneCode AS phoneCode",
                "country.currency AS currency",
                "MIN(plan.price) AS price",
            ])
            .where("country.isActive = true")
            .andWhere("country.isDelete = false")
            .groupBy("country.id")
            .orderBy("country.name", "ASC")
            .getRawMany();

        return res.status(200).json({
            success: true,
            data: result,
        });
    } catch (err: any) {
        console.error("Error fetching countries:", err);
        return res.status(500).json({
            success: false,
            message: "Server error",
        });
    }
};

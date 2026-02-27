import { Request, Response } from "express";
import { AppDataSource } from "../../data-source";
import { Brand } from "../../entity/Brand.entity";

export const getUserBrands = async (req: Request, res: Response) => {
    try {
        const repo = AppDataSource.getRepository(Brand);

        const {
            page = "1",
            limit = "50",
            q,
            sort = "name",
            order = "ASC",
        } = req.query as any;

        const take = Math.min(Number(limit), 100);
        const skip = (Number(page) - 1) * take;

        const qb = repo
            .createQueryBuilder("brand")
            .where("brand.isActive = true");

        // 🔎 Search
        if (q) {
            qb.andWhere("LOWER(brand.name) LIKE LOWER(:q)", {
                q: `%${q}%`,
            });
        }

        // 🔄 Sorting (safe whitelist)
        const sortable = ["name", "createdAt"];
        const safeSort = sortable.includes(sort)
            ? `brand.${sort}`
            : "brand.name";

        qb.orderBy(safeSort, order === "DESC" ? "DESC" : "ASC");

        qb.skip(skip).take(take);

        const [brands, total] = await qb.getManyAndCount();

        return res.json({
            page: Number(page),
            limit: take,
            total,
            pages: Math.ceil(total / take),
            data: brands,
        });

    } catch (err: any) {
        return res.status(500).json({
            message: "Failed to fetch brands",
            error: err.message,
        });
    }
};

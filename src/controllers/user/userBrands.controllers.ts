import { Request, Response } from "express";
import { AppDataSource } from "../../data-source";
import { Brand } from "../../entity/Brand.entity";
import { DeviceOS } from "../../entity/Device.entity";

type ClientType = "ios" | "android" | "browser";

const detectClientType = (userAgent: string): ClientType => {
    const ua = userAgent.toLowerCase();

    if (ua.includes("iphone") || ua.includes("ipad")) {
        return "ios";
    }

    if (ua.includes("android")) {
        return "android";
    }

    return "browser";
};

export const getUserBrands = async (req: Request, res: Response) => {
    try {
        const repo = AppDataSource.getRepository(Brand);

        const userAgent = req.headers["user-agent"] || "";
        const clientType = detectClientType(userAgent);

        console.log("=== Client Detection ===",req.headers);
        // console.log(`Client Type: ${clientType} | User-Agent: ${userAgent}`);

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
            .leftJoin("brand.devices", "device")
            .where("brand.isActive = true");

        // =====================================================
        // 🔥 AUTO FILTER BASED ON CLIENT TYPE
        // =====================================================

        if (clientType === "ios") {
            // Only Apple brand
            qb.andWhere("LOWER(brand.name) = LOWER(:apple)", {
                apple: "Apple",
            });
        }

        else if (clientType === "android") {
            // Exclude Apple brand
            qb.andWhere("LOWER(brand.name) != LOWER(:apple)", {
                apple: "Apple",
            });

            // Optional: ensure brand has ANDROID devices
            qb.andWhere("device.os = :androidOs", {
                androidOs: DeviceOS.ANDROID,
            });
        }
        // else {
        //     // Only Apple brand
        //     qb.andWhere("LOWER(brand.name) = LOWER(:apple)", {
        //         apple: "Apple",
        //     });
        // }

        // Browser → no brand restriction (show all)

        // =====================================================
        // 🔎 Search
        // =====================================================

        if (q) {
            qb.andWhere("LOWER(brand.name) LIKE LOWER(:q)", {
                q: `%${q}%`,
            });
        }

        // =====================================================
        // 🔄 Sorting
        // =====================================================

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
import { Response } from "express";
import { AppDataSource } from "../../data-source";
import { Device } from "../../entity/Device.entity";


export const getUserDevice = async (req: any, res: Response) => {

    try {
        const repo = AppDataSource.getRepository(Device);

        const {
            page = "1",
            limit = "100",

            q,              // global search
            deviceName,     // specific filter
            mobile,         // model filter
            brand,          // brand name filter

            brandId,
            model,
            os,
            active,
            supportsEsim,

            sortBy = "createdAt",
            order = "DESC"
        } = req.query;

        const take = Math.min(Number(limit), 100);
        const skip = (Number(page) - 1) * take;

        const qb = repo
            .createQueryBuilder("device")
            .leftJoinAndSelect("device.brand", "brand");

        // =====================================================
        // 🔍 GLOBAL SEARCH (name + model + brand)
        // =====================================================
        if (q) {
            qb.andWhere(
                `
                (
                    LOWER(device.name) LIKE LOWER(:q)
                    OR LOWER(device.model) LIKE LOWER(:q)
                    OR LOWER(brand.name) LIKE LOWER(:q)
                )
                `,
                { q: `%${String(q).trim()}%` }
            );
        }

        // =====================================================
        // 🎯 SPECIFIC USER FILTERS
        // =====================================================

        if (deviceName) {
            qb.andWhere(
                "LOWER(device.name) LIKE LOWER(:deviceName)",
                { deviceName: `%${deviceName}%` }
            );
        }

        if (mobile) {
            qb.andWhere(
                "LOWER(device.model) LIKE LOWER(:mobile)",
                { mobile: `%${mobile}%` }
            );
        }

        if (brand) {
            qb.andWhere(
                "LOWER(brand.name) LIKE LOWER(:brand)",
                { brand: `%${brand}%` }
            );
        }

        // =====================================================
        // EXISTING FILTERS (unchanged)
        // =====================================================

        if (brandId)
            qb.andWhere("device.brandId = :brandId", { brandId });

        if (model)
            qb.andWhere("device.model = :model", { model });

        if (os)
            qb.andWhere("device.os = :os", { os });

        if (active !== undefined)
            qb.andWhere("device.isActive = :active", {
                active: active === "true"
            });

        if (supportsEsim !== undefined)
            qb.andWhere("device.supportsEsim = :supportsEsim", {
                supportsEsim: supportsEsim === "true"
            });

        // =====================================================
        // SORTING (Safe)
        // =====================================================

        const sortable = ["model", "createdAt", "updatedAt", "name"];

        const safeSort = sortable.includes(sortBy)
            ? `device.${sortBy}`
            : "device.createdAt";

        qb.orderBy(safeSort, order === "ASC" ? "ASC" : "DESC");

        // =====================================================
        // PAGINATION
        // =====================================================

        qb.skip(skip).take(take);

        const [devices, total] = await qb.getManyAndCount();

        return res.json({
            page: Number(page),
            limit: take,
            total,
            pages: Math.ceil(total / take),
            data: devices
        });

    } catch (err: any) {
        return res.status(500).json({
            message: "Failed",
            error: err.message
        });
    }
};

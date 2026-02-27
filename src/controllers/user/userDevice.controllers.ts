import { Request, Response } from "express";
import { AppDataSource } from "../../data-source";
import { Device, DeviceOS } from "../../entity/Device.entity";

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

export const getUserDevice = async (req: Request, res: Response) => {
    try {
        const repo = AppDataSource.getRepository(Device);

        const userAgent = req.headers["user-agent"] || "";
        const clientType = detectClientType(userAgent);

        const {
            page = "1",
            limit = "100",
            q,
            deviceName,
            mobile,
            brand,
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
        // 🔥 AUTO FILTER (only if user didn't manually filter OS)
        // =====================================================

        if (!os) {
            if (clientType === "ios") {
                qb.andWhere("device.os = :autoOs", {
                    autoOs: DeviceOS.IOS,
                });
            }

            else if (clientType === "android") {
                qb.andWhere("device.os = :autoOs", {
                    autoOs: DeviceOS.ANDROID,
                });
            }
            else {
                qb.andWhere("device.os IN (:...autoOsList)", {
                    autoOsList: [DeviceOS.IOS, DeviceOS.ANDROID],
                });
            }

            // browser → show ALL devices (no auto OS filter)
        }

        // =====================================================
        // 🔍 GLOBAL SEARCH
        // =====================================================

        if (q) {
            qb.andWhere(
                `
                (
                    LOWER(device.name) LIKE LOWER(:search)
                    OR LOWER(device.model) LIKE LOWER(:search)
                    OR LOWER(brand.name) LIKE LOWER(:search)
                )
                `,
                { search: `%${String(q).trim()}%` }
            );
        }

        // =====================================================
        // 🎯 SPECIFIC FILTERS
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

        if (brandId) {
            qb.andWhere("device.brandId = :brandId", { brandId });
        }

        if (model) {
            qb.andWhere("device.model = :model", { model });
        }

        // Manual OS filter (explicit override)
        if (os) {
            qb.andWhere("device.os = :filterOs", {
                filterOs: os,
            });
        }

        if (active !== undefined) {
            qb.andWhere("device.isActive = :active", {
                active: active === "true",
            });
        }

        if (supportsEsim !== undefined) {
            qb.andWhere("device.supportsEsim = :supportsEsim", {
                supportsEsim: supportsEsim === "true",
            });
        }

        // =====================================================
        // SORTING
        // =====================================================

        const sortable = ["model", "createdAt", "updatedAt", "name"];

        const safeSort = sortable.includes(String(sortBy))
            ? `device.${sortBy}`
            : "device.createdAt";

        qb.orderBy(
            safeSort,
            order === "ASC" ? "ASC" : "DESC"
        );

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
            data: devices,
        });

    } catch (err: any) {
        return res.status(500).json({
            message: "Failed",
            error: err.message,
        });
    }
};
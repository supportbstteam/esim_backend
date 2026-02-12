import { Response } from "express";
import { Device, DeviceOS } from "../../entity/Device.entity";
import { checkAdmin } from "../../utils/checkAdmin";
import { AppDataSource } from "../../data-source";
import { Brand } from "../../entity/Brand.entity";

export const getDevices = async (req: any, res: Response) => {
    if (!(await checkAdmin(req, res))) return;

    try {
        const repo = AppDataSource.getRepository(Device);

        const {
            page = "1",
            limit = "20",
            q,
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

        // 🔍 Global search
        if (q) {
            qb.andWhere(
                "(LOWER(device.model) LIKE LOWER(:q) OR LOWER(brand.name) LIKE LOWER(:q))",
                { q: `%${q}%` }
            );
        }

        // Filters
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

        // Sorting safe
        const sortable = [
            "model",
            "createdAt",
            "updatedAt"
        ];

        const safeSort = sortable.includes(sortBy)
            ? `device.${sortBy}`
            : "device.createdAt";

        qb.orderBy(safeSort, order === "ASC" ? "ASC" : "DESC");

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
        return res.status(500).json({ message: "Failed", error: err.message });
    }
};

export const postAddDevice = async (req: any, res: Response) => {

    if (!(await checkAdmin(req, res))) return;

    const { data } = req.body;

    if (!Array.isArray(data) || !data.length)
        return res.status(400).json({ message: "data array required" });

    try {

        const deviceRepo = AppDataSource.getRepository(Device);
        const brandRepo = AppDataSource.getRepository(Brand);

        const normalize = (b: string) => b.trim().toLowerCase();

        // ============================================================
        // 1️⃣ Extract brand strings ONLY (ignore brandId entries)
        // ============================================================

        const brandStrings = data
            .map((d: any) => d.brand)
            .filter((b: unknown): b is string =>
                typeof b === "string" && b.trim().length > 0
            );

        const uniqueBrandKeys = [...new Set(brandStrings.map(normalize))];

        // ============================================================
        // 2️⃣ Load existing brands
        // ============================================================

        const brandMap: Record<string, Brand> = {};

        if (uniqueBrandKeys.length) {

            const existingBrands = await brandRepo
                .createQueryBuilder("brand")
                .where("LOWER(brand.name) IN (:...names)", {
                    names: uniqueBrandKeys
                })
                .getMany();

            existingBrands.forEach(b => {
                brandMap[normalize(b.name)] = b;
            });
        }

        // ============================================================
        // 3️⃣ Create missing brands
        // ============================================================

        let missing: { name: string }[] = [];

        if (uniqueBrandKeys.length) {

            missing = uniqueBrandKeys
                .filter(k => !brandMap[k])
                .map(k => ({
                    name: k.charAt(0).toUpperCase() + k.slice(1)
                }));

            if (missing.length) {

                await brandRepo
                    .createQueryBuilder()
                    .insert()
                    .into(Brand)
                    .values(missing)
                    .execute();

                const inserted = await brandRepo
                    .createQueryBuilder("brand")
                    .where("LOWER(brand.name) IN (:...names)", {
                        names: missing.map(m => normalize(m.name))
                    })
                    .getMany();

                inserted.forEach(b => {
                    brandMap[normalize(b.name)] = b;
                });
            }
        }

        // ============================================================
        // 4️⃣ Build device payload
        // ============================================================

        const prepared = await Promise.all(data.map(async (d: any) => {

            if (!d.model || !d.os || !d.name)
                throw new Error("model, name, os required");

            const osNormalized = String(d.os).toUpperCase();

            if (!(osNormalized in DeviceOS))
                throw new Error(`Invalid OS: ${d.os}`);

            let brand: Brand | null = null;

            // ✔ From form
            if (d.brandId) {
                brand = await brandRepo.findOneBy({
                    id: Number(d.brandId)
                });
            }

            // ✔ From bulk import
            else if (d.brand) {
                brand = brandMap[normalize(d.brand)];
            }

            if (!brand)
                throw new Error(`Brand mapping failed`);

            return {
                name: String(d.name).trim(),
                model: String(d.model).trim(),
                brand,
                os: osNormalized as DeviceOS,
                supportsEsim: d.supportsEsim ?? true,
                notes: d.notes ?? d.description ?? null,
                isActive: d.isActive ?? true
            };

        }));

        // ============================================================
        // 5️⃣ Chunk insert
        // ============================================================

        const chunkSize = 200;

        for (let i = 0; i < prepared.length; i += chunkSize) {

            const chunk = prepared.slice(i, i + chunkSize);

            await deviceRepo
                .createQueryBuilder()
                .insert()
                .into(Device)
                .values(chunk)
                .orIgnore()
                .execute();
        }

        // ============================================================
        return res.status(201).json({
            message: `${prepared.length} devices processed`,
            brandsCreated: missing.length,
            data:[],
        });

    } catch (err: any) {

        console.error("Device import error:", err);

        return res.status(500).json({
            message: "Device import failed",
            error: err.message
        });
    }
};


export const updateDevice = async (req: any, res: Response) => {

    if (!(await checkAdmin(req, res))) return;

    const { id } = req.params;
    const { brandId, ...updates } = req.body;

    try {
        const repo = AppDataSource.getRepository(Device);
        const brandRepo = AppDataSource.getRepository(Brand);

        const device = await repo.findOneBy({ id: Number(id) });
        if (!device) return res.status(404).json({ message: "Not found" });

        if (brandId) {
            const brand = await brandRepo.findOneBy({ id: brandId });
            if (!brand)
                return res.status(400).json({ message: "Invalid brand" });

            device.brand = brand;
        }

        repo.merge(device, updates);
        await repo.save(device);

        res.json(device);

    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
};


export const toggleDeviceStatus = async (req: any, res: Response) => {
    if (!(await checkAdmin(req, res))) return;

    const { id } = req.params;
    const { isActive } = req.body;

    // Validate input
    if (typeof isActive !== "boolean") {
        return res.status(400).json({
            message: "isActive must be boolean",
        });
    }

    try {
        const repo = AppDataSource.getRepository(Device);

        const device = await repo.findOneBy({ id: Number(id) });

        if (!device) {
            return res.status(404).json({
                message: "Device not found",
            });
        }

        // Only update what matters
        device.isActive = isActive;

        await repo.save(device);

        return res.json({
            message: "Device status updated",
            id: device.id,
            isActive: device.isActive,
        });

    } catch (err: any) {
        console.error("Toggle device status error:", err);

        return res.status(500).json({
            message: "Failed to update device status",
            error: err.message,
        });
    }
};


export const hardDeleteDevice = async (req: any, res: Response) => {

    if (!(await checkAdmin(req, res))) return;

    const { id } = req.params;

    try {
        const repo = AppDataSource.getRepository(Device);

        const result = await repo.delete(Number(id));

        if (!result.affected)
            return res.status(404).json({ message: "Device not found" });

        return res.json({ message: "Device permanently removed" });

    } catch (err: any) {
        return res.status(500).json({
            message: "Permanent delete failed",
            error: err.message
        });
    }
};

export const deleteDevice = async (req: any, res: Response) => {

    if (!(await checkAdmin(req, res))) return;

    const { id } = req.params;

    try {
        const repo = AppDataSource.getRepository(Device);

        const device = await repo.findOneBy({ id: Number(id) });
        if (!device)
            return res.status(404).json({ message: "Device not found" });

        device.isActive = false;
        await repo.save(device);

        return res.json({ message: "Device disabled" });

    } catch (err: any) {
        return res.status(500).json({
            message: "Delete failed",
            error: err.message
        });
    }
};

export const getBrands = async (_: any, res: Response) => {

    const repo = AppDataSource.getRepository(Brand);
    const brands = await repo.find({ order: { name: "ASC" } });

    res.json(brands);
};

export const deleteBrand = async (req: any, res: Response) => {

    if (!(await checkAdmin(req, res))) return;

    const repo = AppDataSource.getRepository(Brand);

    await repo.delete(req.params.id);

    res.json({ message: "Brand + Devices removed" });
};

export const createBrand = async (req: any, res: Response) => {

    if (!(await checkAdmin(req, res))) return;

    try {
        const repo = AppDataSource.getRepository(Brand);

        // Accept multiple formats
        let payload: string[] = [];

        if (Array.isArray(req.body.name))
            payload = req.body.name;
        else if (typeof req.body.name === "string")
            payload = [req.body.name];
        else if (Array.isArray(req.body.brands))
            payload = req.body.brands;
        else
            return res.status(400).json({ message: "name or brands required" });

        // Normalize + clean
        const normalized = payload
            .map((b) => String(b).trim())
            .filter(Boolean);

        // Remove duplicates (case-insensitive)
        const uniqueLower = [...new Set(
            normalized.map(b => b.toLowerCase())
        )];

        // Check existing brands
        const existing = await repo
            .createQueryBuilder("brand")
            .where("LOWER(brand.name) IN (:...names)", { names: uniqueLower })
            .getMany();

        const existingSet = new Set(
            existing.map(b => b.name.toLowerCase())
        );

        // Prepare new insert list
        const toInsert = normalized
            .filter(b => !existingSet.has(b.toLowerCase()))
            .map(name => ({ name }));

        // Batch insert
        if (toInsert.length) {
            await repo
                .createQueryBuilder()
                .insert()
                .into(Brand)
                .values(toInsert)
                .execute();
        }

        return res.json({
            requested: normalized.length,
            inserted: toInsert.length,
            skippedExisting: existing.length
        });

    } catch (err: any) {
        return res.status(500).json({
            message: "Brand creation failed",
            error: err.message
        });
    }
};

export const updateBrand = async (req: any, res: Response) => {

    if (!(await checkAdmin(req, res))) return;

    const { id } = req.params;
    const { name } = req.body;

    if (!name || !String(name).trim())
        return res.status(400).json({ message: "Brand name required" });

    try {
        const repo = AppDataSource.getRepository(Brand);

        const brand = await repo.findOneBy({ id: Number(id) });
        if (!brand)
            return res.status(404).json({ message: "Brand not found" });

        const normalized = String(name).trim();

        // 🔎 Check duplicate (case-insensitive)
        const duplicate = await repo
            .createQueryBuilder("brand")
            .where("LOWER(brand.name) = LOWER(:name)", { name: normalized })
            .andWhere("brand.id != :id", { id })
            .getOne();

        if (duplicate)
            return res.status(409).json({
                message: "Another brand already uses this name"
            });

        brand.name = normalized;
        await repo.save(brand);

        return res.json({
            message: "Brand updated",
            brand
        });

    } catch (err: any) {
        return res.status(500).json({
            message: "Brand update failed",
            error: err.message
        });
    }
};

export const softDeleteBrand = async (req: any, res: Response) => {

    if (!(await checkAdmin(req, res))) return;

    const { id } = req.params;

    try {
        const repo = AppDataSource.getRepository(Brand);

        const brand = await repo.findOneBy({ id: Number(id) });

        if (!brand)
            return res.status(404).json({ message: "Brand not found" });

        brand.isActive = false;
        await repo.save(brand);

        return res.json({
            message: "Brand disabled",
            brand
        });

    } catch (err: any) {
        return res.status(500).json({
            message: "Soft delete failed",
            error: err.message
        });
    }
};

export const restoreBrand = async (req: any, res: Response) => {

    if (!(await checkAdmin(req, res))) return;

    const repo = AppDataSource.getRepository(Brand);

    const brand = await repo.findOneBy({ id: Number(req.params.id) });

    if (!brand)
        return res.status(404).json({ message: "Not found" });

    brand.isActive = true;
    await repo.save(brand);

    res.json({ message: "Brand restored", brand });
};

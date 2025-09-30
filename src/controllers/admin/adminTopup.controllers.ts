// src/controllers/topupController.ts
import { Response, Request } from "express";
import { AppDataSource } from "../../data-source";
import { Country } from "../../entity/Country.entity";
import { TopUpPlan } from "../../entity/Topup.entity";
import { checkAdmin } from "../../utils/checkAdmin";

/**
 * Create/Update TopUp Plans
 */
export const createTopupPlans = async (req: Request, res: Response) => {
    try {
        const planRepo = AppDataSource.getRepository(TopUpPlan);
        const countryRepo = AppDataSource.getRepository(Country);

        const entries = Array.isArray(req.body) ? req.body : [req.body];
        const savedPlans: TopUpPlan[] = [];

        for (const entry of entries) {
            const {
                country_id,
                id: topupId, // external API ID
                title,
                name,
                data,
                is_unlimited,
                validity_days,
                price,
                currency,
            } = entry;

            // validate country
            const country = await countryRepo.findOneBy({ id: country_id });
            if (!country) {
                console.warn(`Country with ID ${country_id} not found. Skipping plan ${topupId}`);
                continue;
            }

            // find existing plan by external topupId
            let plan = await planRepo.findOneBy({ topupId });
            if (!plan) {
                plan = planRepo.create({ topupId });
            }

            // map fields (only the ones in entity)
            plan.title = title;
            plan.name = name;
            plan.dataLimit = Number(data) || 0;
            plan.validityDays = Number(validity_days) || 0;
            plan.isUnlimited = Boolean(is_unlimited);
            plan.price = Number(price) || 0;
            plan.currency = currency || "USD";
            plan.country = country;

            savedPlans.push(plan);
        }

        await planRepo.save(savedPlans);

        return res.status(200).json({
            message: "TopUp Plans saved/updated successfully",
            count: savedPlans.length,
            plans: savedPlans,
        });
    } catch (err: any) {
        console.error("--- Error in createTopupPlans ---", err);
        return res.status(500).json({ message: "Failed to save plans", error: err.message });
    }
};

/**
 * Get all TopUp Plans (optional filter by country)
 */
export const getTopupPlans = async (req: Request, res: Response) => {
    try {
        const planRepo = AppDataSource.getRepository(TopUpPlan);
        const { countryId } = req.query;

        const plans = await planRepo.find({
            where: {
                isDeleted: false,
                ...(countryId ? { country: { id: String(countryId) } } : {}),
            },
            relations: ["country"],
        });

        return res.status(200).json({ count: plans.length, plans });
    } catch (err: any) {
        console.error("--- Error in getTopupPlans ---", err.message);
        return res.status(500).json({ message: "Failed to fetch plans", error: err.message });
    }
};

/**
 * Get a TopUp Plan by ID
 */
export const getTopupPlanById = async (req: Request, res: Response) => {
    try {
        const planRepo = AppDataSource.getRepository(TopUpPlan);
        const { id } = req.params;

        const plan = await planRepo.findOne({
            where: { id, isDeleted: false },
            relations: ["country"],
        });

        if (!plan) {
            return res.status(404).json({ message: "Plan not found" });
        }

        return res.status(200).json(plan);
    } catch (err: any) {
        console.error("--- Error in getTopupPlanById ---", err.message);
        return res.status(500).json({ message: "Failed to fetch plan", error: err.message });
    }
};

/**
 * Update a TopUp Plan
 */
export const updateTopupPlan = async (req: Request, res: Response) => {
    try {
        const planRepo = AppDataSource.getRepository(TopUpPlan);
        const countryRepo = AppDataSource.getRepository(Country);
        const { id } = req.params;

        let plan = await planRepo.findOne({
            where: { id },
            relations: ["country"],
        });

        if (!plan) {
            return res.status(404).json({ message: "Plan not found" });
        }

        const {
            title,
            name,
            dataLimit,
            validityDays,
            isUnlimited,
            price,
            currency,
            country_id,
        } = req.body;

        if (title) plan.title = title;
        if (name) plan.name = name;
        if (dataLimit !== undefined) plan.dataLimit = Number(dataLimit);
        if (validityDays !== undefined) plan.validityDays = Number(validityDays);
        if (isUnlimited !== undefined) plan.isUnlimited = Boolean(isUnlimited);
        if (price !== undefined) plan.price = Number(price);
        if (currency) plan.currency = currency;

        if (country_id) {
            const country = await countryRepo.findOneBy({ id: country_id });
            if (!country) {
                return res.status(400).json({ message: "Invalid country_id" });
            }
            plan.country = country;
        }

        await planRepo.save(plan);

        return res.status(200).json({ message: "Plan updated successfully", plan });
    } catch (err: any) {
        console.error("--- Error in updateTopupPlan ---", err.message);
        return res.status(500).json({ message: "Failed to update plan", error: err.message });
    }
};

/**
 * Soft Delete a TopUp Plan
 */
export const deleteTopupPlan = async (req: Request, res: Response) => {
    try {
        const planRepo = AppDataSource.getRepository(TopUpPlan);
        const { id } = req.params;

        const plan = await planRepo.findOneBy({ id });
        if (!plan) {
            return res.status(404).json({ message: "Plan not found" });
        }

        plan.isDeleted = true;
        await planRepo.save(plan);

        return res.status(200).json({ message: "Plan soft-deleted successfully" });
    } catch (err: any) {
        console.error("--- Error in deleteTopupPlan ---", err.message);
        return res.status(500).json({ message: "Failed to delete plan", error: err.message });
    }
};


export const postStatusChangeTopup = async (req: any, res: any) => {
    try {
        const isAdmin = await checkAdmin(req, res);
        if (!isAdmin) {
            return res.status(403).json({ message: "Unauthorized" });
        }

        const { id } = req.params; // assuming your route has /:topupId
        const planRepo = AppDataSource.getRepository(TopUpPlan);

        const plan = await planRepo.findOneBy({ id });
        if (!plan) {
            return res.status(404).json({ message: "Top-up plan not found" });
        }

        // toggle or set isActive based on body
        if (typeof req.body.isActive === "boolean") {
            plan.isActive = !req.body.isActive;
        } else {
            plan.isActive = !plan.isActive; // toggle if not explicitly set
        }

        await planRepo.save(plan);

        return res.status(200).json({
            message: `Top-up plan status updated successfully`,
            data: { topupId: plan.topupId, isActive: plan.isActive },
        });
    } catch (err: any) {
        console.error("--- Error in postStatusChangeTopup ---", err.message);
        return res
            .status(500)
            .json({ message: "Failed to change status", error: err.message });
    }
};

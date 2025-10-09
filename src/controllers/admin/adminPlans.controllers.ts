import { Response, Request } from "express";
import { AppDataSource } from "../../data-source";
import { Plan } from "../../entity/Plans.entity";
import { Country } from "../../entity/Country.entity";
import { checkAdmin } from "../../utils/checkAdmin";
/**
 * Controller to save plans from JSON payload
 * Expects body to be an array of plans from third-party API
 */

interface ApiPlan {
    id: number;
    title: string;
    name: string;
    data: number | string;
    call: number | string;
    sms: number | string;
    is_unlimited: boolean;
    validity_days: number | string;
    price: number | string;
    currency: string;
    country_id: string; // since Country.id is uuid
}

export const createPlan = async (req: Request, res: Response) => {
    try {
        const planRepo = AppDataSource.getRepository(Plan);
        const countryRepo = AppDataSource.getRepository(Country);

        // Accept either single object or array
        const entries = Array.isArray(req.body) ? req.body : [req.body];

        const savedPlans: Plan[] = [];

        for (const entry of entries) {
            const {
                country_id,
                planId,
                title,
                name,
                data,
                call,
                sms,
                isUnlimited,
                validityDays,
                price,
                currency,
            } = entry;

            // Validate country
            const country = await countryRepo.findOneBy({ id: country_id });
            if (!country) {
                console.warn(`Country with ID ${country_id} not found. Skipping plan ${planId}`);
                continue;
            }

            // Find existing plan by external API planId
            let plan = await planRepo.findOneBy({ planId });
            if (!plan) {
                plan = planRepo.create({ planId });
            }

            // Map fields
            plan.title = title;
            plan.name = name;
            plan.data = Number(data) || 0;
            plan.call = Number(call) || 0;
            plan.sms = Number(sms) || 0;
            plan.isUnlimited = Boolean(isUnlimited);
            plan.validityDays = Number(validityDays);
            plan.price = String(price);
            plan.currency = currency;
            plan.country = country;

            savedPlans.push(plan);
        }

        await planRepo.save(savedPlans);

        return res.status(200).json({
            message: "Plans saved/updated successfully",
            count: savedPlans.length,
            plans: savedPlans,
        });
    } catch (err: any) {
        console.error("--- Error in createPlan ---", err);
        return res.status(500).json({ message: "Failed to save plans", error: err.message });
    }
};



// GET all plans (optionally filter by country)
export const getPlans = async (req: Request, res: Response) => {
    try {
        const planRepo = AppDataSource.getRepository(Plan);
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
        console.error("--- Error in getPlans ---", err.message);
        return res.status(500).json({ message: "Failed to fetch plans", error: err.message });
    }
};

// GET a single plan by ID
export const getPlanById = async (req: Request, res: Response) => {
    try {
        const planRepo = AppDataSource.getRepository(Plan);
        const { planId } = req.params;

        // Query by UUID id instead of numeric planId
        const plan = await planRepo.findOne({
            where: { id: planId, isDeleted: false },
            relations: ["country"],
        });

        if (!plan) {
            return res.status(404).json({ message: "Plan not found" });
        }

        return res.status(200).json(plan);
    } catch (err: any) {
        console.error("--- Error in getPlanById ---", err.message);
        return res.status(500).json({ message: "Failed to fetch plan", error: err.message });
    }
};


export const updatePlan = async (req: Request, res: Response) => {
    try {
        const planRepo = AppDataSource.getRepository(Plan);
        const countryRepo = AppDataSource.getRepository(Country);
        const { planId } = req.params;

        let plan = await planRepo.findOne({
            where: { planId: Number(planId) },
            relations: ["country"],
        });

        if (!plan) {
            return res.status(404).json({ message: "Plan not found" });
        }

        const {
            title,
            name,
            data,
            call,
            sms,
            isUnlimited,
            validityDays,
            price,
            currency,
            country_id,
        } = req.body;

        if (title) plan.title = title;
        if (name) plan.name = name;
        if (data !== undefined) plan.data = Number(data);
        if (call !== undefined) plan.call = Number(call);
        if (sms !== undefined) plan.sms = Number(sms);
        if (isUnlimited !== undefined) plan.isUnlimited = Boolean(isUnlimited);
        if (validityDays !== undefined) plan.validityDays = Number(validityDays);
        if (price !== undefined) plan.price = String(price); // ✅ decimal -> string
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
        console.error("--- Error in updatePlan ---", err.message);
        return res.status(500).json({ message: "Failed to update plan", error: err.message });
    }
};


// DELETE a plan by ID
export const deletePlan = async (req: Request, res: Response) => {
    try {
        const planRepo = AppDataSource.getRepository(Plan);
        const { planId } = req.params;

        const plan = await planRepo.findOneBy({ id: (planId) });
        if (!plan) {
            return res.status(404).json({ message: "Plan not found" });
        }

        // Soft delete
        plan.isDeleted = true;
        await planRepo.save(plan);

        return res.status(200).json({ message: "Plan soft-deleted successfully" });
    } catch (err: any) {
        console.error("--- Error in deletePlan ---", err);
        return res.status(500).json({ message: "Failed to soft delete plan", error: err.message });
    }
};


export const postImportPlans = async (req: any, res: any) => {
    const { id, role } = req.user;
    const isAdmin = checkAdmin(req, res);
    if (!isAdmin)
        return res.status(401).json({
            messgae: "Unauthrized, Please Login"
        })

    try {



    }
    catch (err: any) {
        return res.status(500).json({ message: "Failed to soft delete plan", error: err.message });
    }
}

export const postStatusChangePlan = async (req: any, res: any) => {
    try {
        const isAdmin = await checkAdmin(req, res);
        if (!isAdmin) {
            return res.status(403).json({ message: "Unauthorized" });
        }

        const { id } = req.params; // assuming your route has /:topupId
        const planRepo = AppDataSource.getRepository(Plan);

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
            data: { topupId: plan.planId, isActive: plan.isActive },
        });
    } catch (err: any) {
        console.error("--- Error in postStatusChangeTopup ---", err.message);
        return res
            .status(500)
            .json({ message: "Failed to change status", error: err.message });
    }
};

export const postAddFeaturingPlan = async (req: any, res: any) => {
    try {
        const isAdmin = await checkAdmin(req, res);
        if (!isAdmin) {
            return res.status(403).json({ message: "Unauthorized" });
        }

        const { id } = req.params; // assuming your route has /:topupId
        const planRepo = AppDataSource.getRepository(Plan);

        const plan = await planRepo.findOneBy({ id });
        if (!plan) {
            return res.status(404).json({ message: "Top-up plan not found" });
        }

        // toggle or set isActive based on body
        if (typeof req.body.isFeatured === "boolean") {
            plan.isFeatured = !req.body.isFeatured;
        } else {
            plan.isFeatured = !plan.isFeatured; // toggle if not explicitly set
        }

        await planRepo.save(plan);

        return res.status(200).json({
            message: `Top-up plan status updated successfully`,
            data: { topupId: plan.planId, isFeatured: plan.isFeatured },
        });
    } catch (err: any) {
        console.error("--- Error in postStatusChangeTopup ---", err.message);
        return res
            .status(500)
            .json({ message: "Failed to change status", error: err.message });
    }
};
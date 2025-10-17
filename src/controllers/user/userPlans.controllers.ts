import { Request, Response } from "express";
import { getDataSource } from "../../lib/serverless";
import { Plan } from "../../entity/Plans.entity";

// -------------------- GET ALL USER PLANS --------------------
export const getUserPlans = async (req: Request, res: Response) => {
  try {
    const { countryId } = req.query;

    const dataSource = await getDataSource();
    const planRepo = dataSource.getRepository(Plan);

    // Include only active and not deleted plans
    let whereCondition: any = { isDeleted: false, isActive: true };

    // Apply country filter only if countryId is passed and not "all"
    if (countryId && countryId !== "all") {
      whereCondition.country = { id: countryId as string };
    }

    const plans = await planRepo.find({
      where: whereCondition,
      relations: ["country"], // join with country table
      order: { price: "ASC" },
    });

    if (plans.length === 0) {
      return res.status(404).json({
        success: false,
        message:
          countryId && countryId !== "all"
            ? "No active plans found for this country"
            : "No active plans found",
      });
    }

    // Format response: include plan + country details
    const formattedPlans = plans.map((plan) => ({
      id: plan.id,
      title: plan.title,
      name: plan.name,
      data: plan.data,
      call: plan.call,
      sms: plan.sms,
      isUnlimited: plan.isUnlimited,
      isFeatured: plan.isFeatured,
      validityDays: plan.validityDays,
      price: plan.price,
      currency: plan.currency,
      planId: plan.planId,
      country: {
        id: plan.country.id,
        name: plan.country.name,
      },
      createdAt: plan.createdAt,
      updatedAt: plan.updatedAt,
    }));

    return res.status(200).json({ success: true, data: formattedPlans });
  } catch (error) {
    console.error("Error fetching plans:", error);
    return res
      .status(500)
      .json({ success: false, message: "Server error", error });
  }
};

// -------------------- GET FEATURED PLANS --------------------
export const getFeaturePlans = async (req: Request, res: Response) => {
  try {
    const { countryId } = req.query;

    const dataSource = await getDataSource();
    const planRepo = dataSource.getRepository(Plan);

    // Include only active, featured, and not deleted plans
    let whereCondition: any = { isDeleted: false, isActive: true, isFeatured: true };

    if (countryId && countryId !== "all") {
      whereCondition.country = { id: countryId as string };
    }

    const plans = await planRepo.find({
      where: whereCondition,
      relations: ["country"],
      order: { price: "ASC" },
    });

    if (plans.length === 0) {
      return res.status(404).json({
        success: false,
        message:
          countryId && countryId !== "all"
            ? "No active featured plans found for this country"
            : "No active featured plans found",
      });
    }

    const formattedPlans = plans.map((plan) => ({
      id: plan.id,
      title: plan.title,
      name: plan.name,
      data: plan.data,
      call: plan.call,
      sms: plan.sms,
      isUnlimited: plan.isUnlimited,
      validityDays: plan.validityDays,
      price: plan.price,
      currency: plan.currency,
      planId: plan.planId,
      country: {
        id: plan.country.id,
        name: plan.country.name,
      },
      createdAt: plan.createdAt,
      updatedAt: plan.updatedAt,
    }));

    return res.status(200).json({ success: true, data: formattedPlans });
  } catch (error) {
    console.error("Error fetching featured plans:", error);
    return res
      .status(500)
      .json({ success: false, message: "Server error", error });
  }
};

// -------------------- GET USER PLAN BY COUNTRY --------------------
export const getUserPlanByCountry = async (req: Request, res: Response) => {
  const { countryId } = req.body;

  try {
    const dataSource = await getDataSource();
    const planRepo = dataSource.getRepository(Plan);

    let whereCondition: any = { isDeleted: false, isActive: true };

    if (countryId && countryId !== "all") {
      whereCondition.country = { id: countryId as string };
    }

    const plans = await planRepo.find({
      where: { ...whereCondition, isActive: true },
      relations: ["country"],
      order: { price: "ASC" },
    });

    if (plans.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No active plans found for this country",
      });
    }

    const formattedPlans = plans.map((plan) => ({
      id: plan.id,
      title: plan.title,
      name: plan.name,
      data: plan.data,
      call: plan.call,
      sms: plan.sms,
      isUnlimited: plan.isUnlimited,
      isFeatured: plan.isFeatured,
      validityDays: plan.validityDays,
      price: plan.price,
      currency: plan.currency,
      planId: plan.planId,
      country: {
        id: plan.country.id,
        name: plan.country.name,
      },
      createdAt: plan.createdAt,
      updatedAt: plan.updatedAt,
    }));

    return res.status(200).json({ success: true, data: formattedPlans });
  } catch (err: any) {
    console.error("Error in getUserPlanByCountry:", err);
    return res
      .status(500)
      .json({ success: false, message: "Server error", error: err });
  }
};

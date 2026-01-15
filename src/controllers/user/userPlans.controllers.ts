import { Request, Response } from "express";
import { getDataSource } from "../../lib/serverless";
import { Plan } from "../../entity/Plans.entity";

// -------------------- GET ALL USER PLANS --------------------
export const getUserPlans = async (req: Request, res: Response) => {
  try {
    const { countryId } = req.query;

    const dataSource = await getDataSource();
    const planRepo = dataSource.getRepository(Plan);

    const qb = planRepo
      .createQueryBuilder("plan")
      .innerJoin("plan.country", "country")
      .select([
        "plan.id AS id",
        "plan.title AS title",
        "plan.name AS name",
        "plan.data AS data",
        "plan.call AS callUnits",   // 🔥 FIX HERE
        "plan.sms AS sms",
        "plan.isUnlimited AS isUnlimited",
        "plan.isFeatured AS isFeatured",
        "plan.validityDays AS validityDays",
        "plan.price AS price",
        "plan.currency AS currency",
        "plan.planId AS planId",
        "plan.createdAt AS createdAt",
        "plan.updatedAt AS updatedAt",
        "country.id AS countryId",
        "country.name AS countryName",
        "country.description AS countryDescription",
      ])
      .where("plan.isDeleted = false")
      .andWhere("plan.isActive = true");

    if (countryId && countryId !== "all") {
      qb.andWhere("country.id = :countryId", { countryId });
    }

    const plans = await qb
      .orderBy("plan.price", "ASC")
      .getRawMany();

    if (!plans.length) {
      return res.status(404).json({
        success: false,
        message:
          countryId && countryId !== "all"
            ? "No active plans found for this country"
            : "No active plans found",
      });
    }

    return res.status(200).json({
      success: true,
      data: plans.map((p) => ({
        id: p.id,
        title: p.title,
        name: p.name,
        data: p.data,
        call: p.call,
        sms: p.sms,
        isUnlimited: p.isUnlimited,
        isFeatured: p.isFeatured,
        validityDays: p.validityDays,
        price: p.price,
        currency: p.currency,
        planId: p.planId,
        country: {
          id: p.countryId,
          name: p.countryName,
          description: p.countryDescription,
        },
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      })),
    });
  } catch (err) {
    console.error("Error fetching plans:", err);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: (err as any).message,
    });
  }
};


// -------------------- GET FEATURED PLANS --------------------
export const getFeaturePlans = async (req: Request, res: Response) => {
  try {
    const { countryId } = req.query;

    const dataSource = await getDataSource();
    const planRepo = dataSource.getRepository(Plan);

    const qb = planRepo
      .createQueryBuilder("plan")
      .innerJoin("plan.country", "country")
      .select([
        "plan.id AS id",
        "plan.title AS title",
        "plan.name AS name",
        "plan.data AS data",
        "plan.call AS callUnits",   // alias to avoid SQL keyword
        "plan.sms AS sms",
        "plan.isUnlimited AS isUnlimited",
        "plan.validityDays AS validityDays",
        "plan.price AS price",
        "plan.currency AS currency",
        "plan.planId AS planId",
        "plan.createdAt AS createdAt",
        "plan.updatedAt AS updatedAt",
        "country.id AS countryId",
        "country.name AS countryName",
        "country.isoCode AS iso2",
        "country.iso3Code AS iso3",
      ])
      .where("plan.isDeleted = false")
      .andWhere("plan.isActive = true")
      .andWhere("plan.isFeatured = true");

    if (countryId && countryId !== "all") {
      qb.andWhere("country.id = :countryId", { countryId });
    }

    const plans = await qb
      .orderBy("plan.price", "ASC")
      .getRawMany();

    if (!plans.length) {
      return res.status(404).json({
        success: false,
        message:
          countryId && countryId !== "all"
            ? "No active featured plans found for this country"
            : "No active featured plans found",
      });
    }

    return res.status(200).json({
      success: true,
      data: plans.map((p) => ({
        id: p.id,
        title: p.title,
        name: p.name,
        data: p.data,
        call: p.callUnits,
        sms: p.sms,
        isUnlimited: p.isUnlimited,
        validityDays: p.validityDays,
        price: p.price,
        currency: p.currency,
        planId: p.planId,
        country: {
          id: p.countryId,
          name: p.countryName,
          iso2: p.iso2,
          iso3: p.iso3,
        },
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      })),
    });
  } catch (error) {
    console.error("Error fetching featured plans:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
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

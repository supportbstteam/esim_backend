import { AppDataSource } from "../../data-source";
import { Plan } from "../../entity/Plans";
import { getDataSource } from "../../lib/serverless";

export const getUserPlans = async (req: any, res: any) => {
  try {
    const { countryId } = req.query;

    const dataSource = await getDataSource();
    const planRepo = dataSource.getRepository(Plan);

    let whereCondition: any = { isDeleted: false };

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
            ? "No plans found for this country"
            : "No plans found",
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

export const getUserPlanByCountry = async (req: any, res: any) => {
  const { countryId } = req.body;
  try {

    const dataSource = await getDataSource();
    const planRepo = dataSource.getRepository(Plan);
    let whereCondition: any = { isDeleted: false };

    // const plans = 
  }
  catch (err: any) {
    console.error("Error in the get user plan by country ", err);

  }
}
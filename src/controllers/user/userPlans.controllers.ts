// import { Request, Response } from "express";
// import { getDataSource } from "../../lib/serverless";
// import { Plan } from "../../entity/Plans.entity";

// // -------------------- GET ALL USER PLANS --------------------
// export const getUserPlans = async (req: Request, res: Response) => {
//   try {
//     const { countryId } = req.query;

//     const dataSource = await getDataSource();
//     const planRepo = dataSource.getRepository(Plan);

//     const query = planRepo
//       .createQueryBuilder("plan")
//       .leftJoinAndSelect("plan.country", "country")
//       .addSelect([
//         "country.imageUrl",
//         "country.description",
//         "country.metaTitle",
//         "country.metaDescription",
//         "country.metaKeywords",
//       ])
//       .where("plan.isDeleted = :isDeleted", { isDeleted: false })
//       .andWhere("plan.isActive = :isActive", { isActive: true });

//     // Apply country filter
//     if (countryId && countryId !== "all") {
//       query.andWhere("country.id = :countryId", { countryId });
//     }

//     const plans = await query.orderBy("plan.price", "ASC").getMany();

//     if (!plans.length) {
//       return res.status(404).json({
//         success: false,
//         message:
//           countryId && countryId !== "all"
//             ? "No active plans found for this country"
//             : "No active plans found",
//       });
//     }

//     const formattedPlans = plans.map((plan) => ({
//       id: plan.id,
//       title: plan.title,
//       name: plan.name,
//       data: plan.data,
//       call: plan.call,
//       sms: plan.sms,
//       isUnlimited: plan.isUnlimited,
//       isFeatured: plan.isFeatured,
//       validityDays: plan.validityDays,
//       price: plan.price,
//       currency: plan.currency,
//       planId: plan.planId,
//       planId: plan.planId,

//       country: {
//         id: plan.country.id,
//         name: plan.country.name,
//         description: plan?.country?.description || "",
//         iso2: plan?.country?.isoCode,
//         iso3Code: plan?.country?.iso3Code,
//         imageUrl: plan?.country?.imageUrl || "",
//         image: plan?.country?.imageUrl || "",

//         // SEO
//         metaTitle: plan?.country?.metaTitle,
//         metaDescription: plan?.country?.metaDescription,
//         metaKeywords: plan?.country?.metaKeywords,
//       },

//       createdAt: plan.createdAt,
//       updatedAt: plan.updatedAt,
//     }));

//     return res.status(200).json({
//       success: true,
//       data: formattedPlans,
//     });
//   } catch (err: any) {
//     console.error("Error fetching plans:", err);
//     return res.status(500).json({
//       success: false,
//       message: "Server error",
//       error: err.message,
//     });
//   }
// };

// // -------------------- GET FEATURED PLANS --------------------
// export const getFeaturePlans = async (req: any, res: Response) => {
//   try {
//     const { countryId } = req.query;

//     const dataSource = await getDataSource();
//     const planRepo = dataSource.getRepository(Plan);

//     // Include only active, featured, and not deleted plans
//     let whereCondition: any = {
//       isDeleted: false,
//       isActive: true,
//       isFeatured: true,
//     };

//     if (countryId && countryId !== "all") {
//       whereCondition.country = { id: countryId as string };
//     }

//     const plans = await planRepo.find({
//       where: whereCondition,
//       relations: ["country"],
//       order: { price: "ASC" },
//     });

//     if (plans.length === 0) {
//       return res.status(404).json({
//         success: false,
//         message:
//           countryId && countryId !== "all"
//             ? "No active featured plans found for this country"
//             : "No active featured plans found",
//       });
//     }

//     const formattedPlans = plans.map((plan) => {
//       console.log("plan", plan);
//       return {
//         id: plan.id,
//         title: plan.title,
//         name: plan.name,
//         data: plan.data,
//         call: plan.call,
//         sms: plan.sms,
//         isUnlimited: plan.isUnlimited,
//         validityDays: plan.validityDays,
//         price: plan.price,
//         currency: plan.currency,
//         planId: plan.planId,
//         country: {
//           id: plan.country.id,
//           name: plan.country.name,
//           iso2: plan?.country?.isoCode,
//           ios3: plan?.country?.iso3Code,
//           imageUrl: plan?.country?.imageUrl,
//           image: plan?.country?.imageUrl,
//         },
//         createdAt: plan.createdAt,
//         updatedAt: plan.updatedAt,
//       };
//     });

//     return res.status(200).json({ success: true, data: formattedPlans });
//   } catch (error) {
//     console.error("Error fetching featured plans:", error);
//     return res
//       .status(500)
//       .json({ success: false, message: "Server error", error });
//   }
// };

// // -------------------- GET USER PLAN BY COUNTRY --------------------
// export const getUserPlanByCountry = async (req: any, res: Response) => {
//   const { countryId } = req.body;

//   try {
//     const dataSource = await getDataSource();
//     const planRepo = dataSource.getRepository(Plan);

//     let whereCondition: any = { isDeleted: false, isActive: true };

//     if (countryId && countryId !== "all") {
//       whereCondition.country = { id: countryId as string };
//     }

//     const plans = await planRepo.find({
//       where: { ...whereCondition, isActive: true },
//       relations: ["country"],
//       order: { price: "ASC" },
//     });

//     if (plans.length === 0) {
//       return res.status(404).json({
//         success: false,
//         message: "No active plans found for this country",
//       });
//     }

//     const formattedPlans = plans.map((plan) => ({
//       id: plan.id,
//       title: plan.title,
//       name: plan.name,
//       data: plan.data,
//       call: plan.call,
//       sms: plan.sms,
//       isUnlimited: plan.isUnlimited,
//       isFeatured: plan.isFeatured,
//       validityDays: plan.validityDays,
//       price: plan.price,
//       currency: plan.currency,
//       planId: plan.planId,
//       country: {
//         id: plan.country.id,
//         name: plan.country.name,
//         imageUrl: plan?.country?.imageUrl,
//         image: plan?.country?.imageUrl,
//       },
//       createdAt: plan.createdAt,
//       updatedAt: plan.updatedAt,
//     }));

//     return res.status(200).json({ success: true, data: formattedPlans });
//   } catch (err: any) {
//     console.error("Error in getUserPlanByCountry:", err);
//     return res
//       .status(500)
//       .json({ success: false, message: "Server error", error: err });
//   }
// };

import { Request, Response } from "express";
import { getDataSource } from "../../lib/serverless";
import { Plan } from "../../entity/Plans.entity";

const formatSlugToName = (slug: string) => {
  return slug
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

// -------------------- GET ALL USER PLANS --------------------
export const getUserPlans = async (req: Request, res: Response) => {
  try {
    const { name } = req.query;

    const dataSource = await getDataSource();
    const planRepo = dataSource.getRepository(Plan);

    const query = planRepo
      .createQueryBuilder("plan")
      .leftJoinAndSelect("plan.country", "country")
      .addSelect([
        "country.imageUrl",
        "country.description",
        "country.metaTitle",
        "country.metaDescription",
        "country.metaKeywords",
      ])
      .where("plan.isDeleted = :isDeleted", { isDeleted: false })
      .andWhere("plan.isActive = :isActive", { isActive: true });

    // Apply country filter by NAME instead of ID
    // convert slug -> proper name
    if (name && name !== "all") {
      const formattedName = formatSlugToName(String(name));
      query.andWhere("country.name = :name", { name: formattedName });
    }

    const plans = await query.orderBy("plan.price", "ASC").getMany();

    if (!plans.length) {
      return res.status(404).json({
        success: false,
        message:
          name && name !== "all"
            ? "No active plans found for this country"
            : "No active plans found",
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
        description: plan?.country?.description || "",
        iso2: plan?.country?.isoCode,
        iso3Code: plan?.country?.iso3Code,
        imageUrl: plan?.country?.imageUrl || "",
        image: plan?.country?.imageUrl || "",

        // SEO
        metaTitle: plan?.country?.metaTitle,
        metaDescription: plan?.country?.metaDescription,
        metaKeywords: plan?.country?.metaKeywords,
      },

      createdAt: plan.createdAt,
      updatedAt: plan.updatedAt,
    }));

    return res.status(200).json({
      success: true,
      data: formattedPlans,
    });
  } catch (err: any) {
    console.error("Error fetching plans:", err);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message,
    });
  }
};

// -------------------- GET FEATURED PLANS --------------------
export const getFeaturePlans = async (req: any, res: Response) => {
  try {
    const { countryId } = req.query;

    const dataSource = await getDataSource();
    const planRepo = dataSource.getRepository(Plan);

    // Include only active, featured, and not deleted plans
    let whereCondition: any = {
      isDeleted: false,
      isActive: true,
      isFeatured: true,
    };

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

    const formattedPlans = plans.map((plan) => {
      console.log("plan", plan);
      return {
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
          iso2: plan?.country?.isoCode,
          ios3: plan?.country?.iso3Code,
          imageUrl: plan?.country?.imageUrl,
          image: plan?.country?.imageUrl,
        },
        createdAt: plan.createdAt,
        updatedAt: plan.updatedAt,
      };
    });

    return res.status(200).json({ success: true, data: formattedPlans });
  } catch (error) {
    console.error("Error fetching featured plans:", error);
    return res
      .status(500)
      .json({ success: false, message: "Server error", error });
  }
};

// -------------------- GET USER PLAN BY COUNTRY --------------------
export const getUserPlanByCountry = async (req: any, res: Response) => {
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
        imageUrl: plan?.country?.imageUrl,
        image: plan?.country?.imageUrl,
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

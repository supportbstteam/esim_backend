import axios from "axios";
import { AppDataSource } from "../../data-source";
import { Admin } from "../../entity/Admin.entity";
import { Token } from "../../entity/Token.entity";
import { tokenTurismApi, verifyTokenTruismAPi } from "../../service/token.service";
import { Country } from "../../entity/Country.entity";
import { Plan } from "../../entity/Plans.entity";
import { TopUpPlan } from "../../entity/Topup.entity";

export const postSchedularImportPlans = async () => {
  try {
    const tokenRepo: any = AppDataSource.getRepository(Token);
    let token: any = await tokenRepo.findOne({
      select: ["token"],
      where: {} // required, even if empty
    });

    // 🧩 Step 1: Ensure we have a valid token
    let isValid = false;
    if (token?.token) {
      isValid = await verifyTokenTruismAPi(token.token);
    }

    // console.log("---- validating token ------");
    if (!isValid) {
      console.log("🔄 Token expired or invalid, regenerating...");
      const newToken = await tokenTurismApi();

      if (token) {
        token.token = newToken;
        await tokenRepo.save(token);
      } else {
        // console.log("---- new validating token ------");
        const newTokenEntity = tokenRepo.create({ token: newToken });
        await tokenRepo.save(newTokenEntity);
        token = newTokenEntity;
      }
    }

    const authHeader = { Authorization: `Bearer ${token?.token}` };


    // console.log("---- importing api plan token ------");
    // 🧩 Step 2: Fetch Plans
    const planRes = await axios.get(`${process.env.TURISM_URL}/v2/plans`, { headers: authHeader });
    const plansFromApi = planRes.data?.data || [];
    if (!plansFromApi.length) {
      console.warn("⚠️ No plans found from API");
      return;
    }

    const countryRepo = AppDataSource.getRepository(Country);
    const planRepo = AppDataSource.getRepository(Plan);

    for (const apiPlan of plansFromApi) {
      const countryData = apiPlan.country;
      if (!countryData) continue;

      let country = await countryRepo.findOne({ where: { name: countryData.name } });
      if (!country) {
        country = countryRepo.create({
          name: countryData.name,
          isoCode: countryData.code || "",
          iso3Code: countryData.iso3 || "",
          phoneCode: countryData.phoneCode || "0",
          currency: countryData.currency || "USD",
          isActive: true,
          isDelete: false,
        });
        await countryRepo.save(country);
      }

      let plan = await planRepo.findOne({ where: { planId: apiPlan.id } });
      if (!plan) {
        plan = planRepo.create({
          planId: apiPlan.id,
          title: apiPlan.title,
          name: apiPlan.name,
          data: apiPlan.data,
          call: apiPlan.call,
          sms: apiPlan.sms,
          isUnlimited: apiPlan.is_unlimited,
          validityDays: apiPlan.validity_days,
          price: apiPlan.price,
          currency: apiPlan.currency,
          country,
          isDeleted: false,
        });
      } else {
        Object.assign(plan, {
          title: apiPlan.title,
          name: apiPlan.name,
          data: apiPlan.data,
          call: apiPlan.call,
          sms: apiPlan.sms,
          isUnlimited: apiPlan.is_unlimited,
          validityDays: apiPlan.validity_days,
          price: apiPlan.price,
          currency: apiPlan.currency,
          country,
        });
      }

      await planRepo.save(plan);
      // console.log("---- importing plan saved ------");
    }


    // console.log("---- top up plan api import token ------");
    // 🧩 Step 3: Fetch Top-up Plans
    const topUpApiResponse = await axios.get(`${process.env.TURISM_URL}/v2/plans/topup-plans`, {
      headers: authHeader,
    });

    const topUps = topUpApiResponse.data?.data || [];
    if (!topUps.length) {
      console.warn("⚠️ No top-ups found from API");
      return;
    }

    const topUpRepo = AppDataSource.getRepository(TopUpPlan);

    for (const apiTopUp of topUps) {
      const countryData = apiTopUp.country;
      if (!countryData) continue;

      let country = await countryRepo.findOne({ where: { name: countryData.name } });
      if (!country) {
        country = countryRepo.create({
          name: countryData.name,
          isoCode: countryData.code || "",
          iso3Code: countryData.iso3 || "",
          phoneCode: countryData.phoneCode || "0",
          currency: countryData.currency || "USD",
          isActive: true,
          isDelete: false,
        });
        await countryRepo.save(country);
      }

      let topUp = await topUpRepo.findOne({ where: { topupId: apiTopUp.id } });
      if (!topUp) {
        topUp = topUpRepo.create({
          topupId: apiTopUp.id,
          title: apiTopUp.title,
          name: apiTopUp.name,
          price: parseFloat(apiTopUp.price),
          dataLimit: apiTopUp.data || 0,
          validityDays: apiTopUp.validity_days || 0,
          isUnlimited: apiTopUp.is_unlimited,
          currency: apiTopUp.currency || "USD",
          country,
          isDeleted: false,
        });
      } else {
        Object.assign(topUp, {
          title: apiTopUp.title,
          name: apiTopUp.name,
          price: parseFloat(apiTopUp.price),
          dataLimit: apiTopUp.data || 0,
          validityDays: apiTopUp.validity_days || 0,
          isUnlimited: apiTopUp.is_unlimited,
          currency: apiTopUp.currency || "USD",
          country,
        });
      }

      await topUpRepo.save(topUp);
      // console.log("---- Top up imported ------");
    }

    console.log("✅ Scheduler successfully updated plans and top-ups");
    return { message: "Successfully Updated" };
  } catch (err) {
    console.error("❌ Error in the scheduler:", err);
  }
};
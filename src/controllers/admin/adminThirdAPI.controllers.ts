import { Response, Request } from "express";
import { tokenTurismApi } from "../../service/token.service";
import { Token } from "../../entity/Token.entity";
import { AppDataSource } from "../../data-source";
import { checkAdmin } from "../../utils/checkAdmin";
import axios from "axios";
import { Country } from "../../entity/Country.entity";
import { Plan } from "../../entity/Plans.entity";
import { TopUpPlan } from "../../entity/Topup.entity";

export const thirdPartyLogin = async (req: any, res: Response) => {
    // console.log("---- third party login ----", req);
    try {

        // ✅ Admin check
        const isAdmin = await checkAdmin(req, res);
        // console.log("---- isAdmin ----", isAdmin);
        if (!isAdmin) {
            return;
        }

        // ✅ Call third-party login service
        const apiResponse: any = await tokenTurismApi();

        if (apiResponse?.status === 200 && apiResponse.data) {
            const tokenRepo = AppDataSource.getRepository(Token);

            const newToken = apiResponse.data.token;
            const SIX_DAYS_IN_SECONDS = 6 * 24 * 60 * 60;
            const expiresIn = apiResponse.data.expires_in || SIX_DAYS_IN_SECONDS;
            const expiryDate = new Date(Date.now() + expiresIn * 1000);


            // ✅ Either update existing token row or insert new
            let tokenRow = await tokenRepo.findOneBy({ provider: "Turisim API" });
            if (tokenRow) {
                tokenRow.token = newToken;
                tokenRow.expiry = expiryDate;
                await tokenRepo.save(tokenRow);
            } else {
                tokenRow = tokenRepo.create({
                    provider: "Turisim API",
                    token: newToken,
                    expiry: expiryDate,
                });
                await tokenRepo.save(tokenRow);
            }

            return res.status(200).json({
                message: "Third-party login successful",
                token: newToken,
                expiry: expiryDate,
            });
        } else {
            return res.status(400).json({
                message: "Third-party login failed",
                response: apiResponse?.data || null,
            });
        }
    } catch (err: any) {
        console.error("--- error in thirdPartyLogin ---", err.response?.data || err.message);
        return res.status(500).json({
            message: "Error logging into third-party API",
            error: err.response?.data || err.message,
        });
    }
};


export const thirdPartyGetPlans = async (req: any, res: any) => {
    try {
        const apiResponse = await axios.get(`${process.env.TURISM_URL}/v2/plans`, {
            params: req.query || req.body, // 👈 use query parameters
            headers: {
                Authorization: `Bearer ${req.thirdPartyToken}`,
            },
        });
        res.status(apiResponse.status).json(apiResponse.data);
    } catch (err: any) {
        console.error("--- error in the turism third party api ---", err.response?.data || err.message);
        res.status(err.response?.status || 500).json({
            message: "Failed to fetch plans from third-party API",
            error: err.response?.data || err.message,
        });
    }
}

export const thirdPartyGetTopup = async (req: any, res: any) => {
    try {
        const apiResponse = await axios.get(`${process.env.TURISM_URL}/v2/plans/topup-plans`, {
            params: req.query || req.body, // 👈 use query parameters
            headers: {
                Authorization: `Bearer ${req.thirdPartyToken}`,
            },
        });
        res.status(apiResponse.status).json(apiResponse.data);
    } catch (err: any) {
        console.error("--- error in the turism third party api ---", err.response?.data || err.message);
        res.status(err.response?.status || 500).json({
            message: "Failed to fetch plans from third-party API",
            error: err.response?.data || err.message,
        });
    }
}

export const postImportThirdPartyPlans = async (req: any, res: Response) => {
    const { id, role } = req.user;

    const isAdmin = checkAdmin(req, res);

    console.log("------- third party token----", req.thirdPartyToken);
    if (!isAdmin)
        return res.status(401).json({
            message: "Unauthorized, please login",
        });

    try {
        // 1️⃣ Fetch data from 3rd-party API
        const apiResponse = await axios.get(`${process.env.TURISM_URL}/v2/plans`, {
            params: req.query || req.body,
            headers: {
                Authorization: `Bearer ${req.thirdPartyToken}`,
            },
        });

        const plansFromApi = apiResponse.data.data; // array of plans

        if (!plansFromApi || plansFromApi.length === 0) {
            return res.status(404).json({ message: "No plans returned from API" });
        }

        const countryRepo = AppDataSource.getRepository(Country);
        const planRepo = AppDataSource.getRepository(Plan);


        for (const apiPlan of plansFromApi) {
            // 2️⃣ Handle country
            const countryData = apiPlan.country;

            console.log("------ country name ----", countryData)
            if (!countryData) continue;

            // Check if country exists by name
            let country = await countryRepo.findOne({ where: { name: countryData.name } });

            if (!country) {
                // New country → insert
                country = countryRepo.create({
                    name: countryData.name,
                    isoCode: countryData.code || "", // e.g., "TR"
                    iso3Code: countryData.iso3 || "", // e.g., "TUR"
                    phoneCode: countryData.phoneCode || "0",
                    currency: countryData.currency || "USD",
                    isActive: true,
                    isDelete: false,
                });

                await countryRepo.save(country);
            }

            // 3️⃣ Handle plan
            let plan = await planRepo.findOne({ where: { planId: apiPlan.id } });

            if (!plan) {
                // New plan → insert
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
                    country: country,
                    isDeleted: false,
                });

                await planRepo.save(plan);
            } else {
                // Existing plan → update fields
                plan.title = apiPlan.title;
                plan.name = apiPlan.name;
                plan.data = apiPlan.data;
                plan.call = apiPlan.call;
                plan.sms = apiPlan.sms;
                plan.isUnlimited = apiPlan.is_unlimited;
                plan.validityDays = apiPlan.validity_days;
                plan.price = apiPlan.price;
                plan.currency = apiPlan.currency;
                plan.country = country;

                await planRepo.save(plan);
            }
        }

        return res.status(200).json({
            success: true,
            message: "Plans imported/updated successfully",
        });
    } catch (err: any) {
        console.error(err);
        return res.status(500).json({
            success: false,
            message: "Failed to import plans",
            error: err.message,
        });
    }
};

export const postImportTopUpPlans = async (req: any, res: Response) => {
    const isAdmin = checkAdmin(req, res);
    if (!isAdmin)
        return res.status(401).json({ message: "Unauthorized, please login" });

    console.log("---- top up token ----", req.thirdPartyToken)

    try {
        // 1️⃣ Fetch top-up plans from API
        const apiResponse = await axios.get(`${process.env.TURISM_URL}/v2/plans/topup-plans`, {
            params: req.query || req.body,
            headers: {
                Authorization: `Bearer ${req.thirdPartyToken}`,
            },
        });

        const topUps = apiResponse.data.data; // array of top-up plans
        if (!topUps || topUps.length === 0) {
            return res.status(404).json({ message: "No top-up plans returned from API" });
        }

        // 2️⃣ Repositories
        const countryRepo = AppDataSource.getRepository(Country);
        const topUpRepo = AppDataSource.getRepository(TopUpPlan);

        for (const apiTopUp of topUps) {
            // Handle country
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

            // Handle top-up plan
            let topUp = await topUpRepo.findOne({ where: { topupId: apiTopUp.id } });

            if (!topUp) {
                // New top-up plan
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
                await topUpRepo.save(topUp);
            } else {
                // Update existing
                topUp.title = apiTopUp.title;
                topUp.name = apiTopUp.name;
                topUp.price = parseFloat(apiTopUp.price);
                topUp.dataLimit = apiTopUp.data || 0;
                topUp.validityDays = apiTopUp.validity_days || 0;
                topUp.isUnlimited = apiTopUp.is_unlimited;
                topUp.currency = apiTopUp.currency || "USD";
                topUp.country = country;

                await topUpRepo.save(topUp);
            }
        }

        return res.status(200).json({
            success: true,
            message: "Top-up plans imported/updated successfully",
        });
    } catch (err: any) {
        console.error(err);
        return res.status(500).json({
            success: false,
            message: "Failed to import top-up plans",
            error: err.message,
        });
    }
};

// { id: 237, code: 'EU', name: null, iso3: null }
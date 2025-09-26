import { Response, Request } from "express";
import { tokenTurismApi } from "../../service/token.service";
import { Token } from "../../entity/Token";
import { AppDataSource } from "../../data-source";
import { checkAdmin } from "../../utils/checkAdmin";
import axios from "axios";

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
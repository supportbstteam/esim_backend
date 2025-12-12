import { Request, Response, NextFunction } from "express";
import { AppDataSource } from "../data-source";
import { Token } from "../entity/Token.entity";
import { tokenTurismApi } from "../service/token.service";
import axios from "axios";

export const thirdPartyAuthMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tokenRepo = AppDataSource.getRepository(Token);

    // Get the token from DB
    let tokenRow = await tokenRepo.findOneBy({ provider: "Turisim API" });

    // If no token in DB → fetch new one
    if (!tokenRow) {
      const apiResponse = await tokenTurismApi();
      if (!apiResponse?.data?.token) {
        return res.status(500).json({ message: "Failed to fetch third-party token" });
      }

      const expiresIn = apiResponse.data.expires_in || 3600;
      const expiryDate = new Date(Date.now() + expiresIn * 1000);

      tokenRow = tokenRepo.create({
        provider: "Turisim API",
        token: apiResponse.data.token,
        expiry: expiryDate,
      });
      await tokenRepo.save(tokenRow);
    }

    // Validate token with third-party API
    try {
      const response = await axios.get(`${process.env.TURISM_URL}/v2/auth-check`, {
        headers: { Authorization: `Bearer ${tokenRow.token}` },
      });

      if (response?.status === 200) {
        (req as any).thirdPartyToken = tokenRow.token; // attach valid token
        return next();
      }
    } catch (err) {
      console.warn("Third-party token invalid, refreshing...");
    }

    // If token invalid → refresh via tokenTurismApi
    const apiResponse = await tokenTurismApi();
    if (!apiResponse?.data?.token) {
      return res.status(500).json({ message: "Failed to refresh third-party token" });
    }

    const expiresIn = apiResponse.data.expires_in || 3600;
    const expiryDate = new Date(Date.now() + expiresIn * 1000);

    tokenRow.token = apiResponse.data.token;
    tokenRow.expiry = expiryDate;
    await tokenRepo.save(tokenRow);

    (req as any).thirdPartyToken = tokenRow.token;
    next();
  } catch (error: any) {
    console.error("--- Error in thirdPartyAuthMiddleware ---", error.message);
    return res.status(500).json({ message: "Third-party auth error", error: error.message });
  }
};

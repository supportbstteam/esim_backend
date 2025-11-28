import { AppDataSource } from "../data-source";
import { Token } from "../entity/Token.entity";
import { tokenTurismApi,verifyTokenTruismAPi } from "../service/token.service";

/**
 * 🔐 Ensures a valid Turisim API token.
 * - Reads from DB if valid
 * - Verifies token via /v2/auth-check
 * - Refreshes and stores if invalid or expired
 * - Always returns a working token string
 */
export const getValidThirdPartyToken = async (): Promise<string> => {
  const tokenRepo = AppDataSource.getRepository(Token);
  const provider = "Turisim API";

  try {
    // 1️⃣ Get current token from DB
    let tokenRow = await tokenRepo.findOne({ where: { provider } });

    // 2️⃣ If no token, generate new
    if (!tokenRow) {
      // console.log("🟠 No Turisim token found — generating new one...");
      const apiResponse = await tokenTurismApi();
      const token = apiResponse?.data?.token;

      if (!token) throw new Error("Failed to fetch new token from Turisim API");

      const expiresIn = apiResponse.data.expires_in || 3600;
      const expiryDate = new Date(Date.now() + expiresIn * 1000);

      tokenRow = tokenRepo.create({ provider, token, expiry: expiryDate });
      await tokenRepo.save(tokenRow);
      // console.log("✅ Token created and saved in DB");
      return token;
    }

    // 3️⃣ Check expiry
    if (tokenRow.expiry && new Date(tokenRow.expiry) < new Date()) {
      // console.log("⚠️ Token expired — refreshing...");
      const apiResponse = await tokenTurismApi();
      const token = apiResponse?.data?.token;
      if (!token) throw new Error("Failed to refresh Turisim token");

      const expiresIn = apiResponse.data.expires_in || 3600;
      const expiryDate = new Date(Date.now() + expiresIn * 1000);

      tokenRow.token = token;
      tokenRow.expiry = expiryDate;
      await tokenRepo.save(tokenRow);
      // console.log("✅ Token refreshed and saved");
      return token;
    }

    // 4️⃣ Verify token with API
    const isValid = await verifyTokenTruismAPi(tokenRow.token);
    if (isValid) {
      // console.log("✅ Turisim token valid");
      return tokenRow.token;
    }

    // 5️⃣ If verification fails → refresh token
    // console.log("⚠️ Token invalid — generating new...");
    const apiResponse = await tokenTurismApi();
    const token = apiResponse?.data?.token;
    if (!token) throw new Error("Failed to refresh invalid token");

    const expiresIn = apiResponse.data.expires_in || 3600;
    const expiryDate = new Date(Date.now() + expiresIn * 1000);

    tokenRow.token = token;
    tokenRow.expiry = expiryDate;
    await tokenRepo.save(tokenRow);
    // console.log("✅ Token refreshed after failed verification");

    return token;
  } catch (err: any) {
    console.error("❌ getValidThirdPartyToken error:", err.message);
    throw new Error("Failed to get valid Turisim token");
  }
};

import axios from "axios";

export const tokenTurismApi = async () => {
    try {

        const apiResponse = await axios.post(`${process.env.TURISM_URL}/v2/token`, {
            email: process.env.TURISM_EMAIL,
            password: process.env.TURISM_PASSWORD,
            token_name: process.env.TURISM_TOKEN_NAME,
        });

        if (apiResponse?.data && apiResponse?.data?.status === "success") {
            return {
                status: 200,
                data: apiResponse.data, // return token & expiry if needed
            };

        }

    } catch (err: any) {
        console.error("--- error in the turism third party api ---", err.response?.data || err.message);

        return {
            message: "Failed to login to third-party API",
            error: err.response?.data || err.message,
        };
    }
}

export const verifyTokenTruismAPi = async (token: string) => {
    try {
        const response = await axios.get(`${process.env.TURISM_URL}/v2/auth-check`, {
            headers: { Authorization: `Bearer ${token}` },
        });

        if (response?.status === 200) {
            return true;
        }
        return false
    } catch (err) {
        console.warn("Third-party token invalid,Please refreshing...");
        return false;
    }
}


export const tokenTurismApiForSchedular = async (): Promise<string | null> => {
    try {
        const apiResponse = await axios.post(`${process.env.TURISM_URL}/v2/token`, {
            email: process.env.TURISM_EMAIL,
            password: process.env.TURISM_PASSWORD,
            token_name: process.env.TURISM_TOKEN_NAME,
        });

        // Validate and extract token
        if (apiResponse?.data?.status === "success" && apiResponse.data?.token) {
            console.log("✅ New third-party token generated successfully");
            return apiResponse.data.token; // return only token
        } else {
            console.error("❌ Token generation failed: Invalid response structure", apiResponse.data);
            return null;
        }

    } catch (err: any) {
        console.error("--- error in the turism third party api ---", err.response?.data || err.message);
        return null;
    }
};
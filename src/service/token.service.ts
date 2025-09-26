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
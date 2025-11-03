import axios from "axios";

interface CreateEsimResponse {
    success: boolean;
    data?: {
        externalId: string;
        iccid: string;
        qrCodeUrl: string;
        [key: string]: any;
    };
    error?: string;
}

/**
 * Create eSIM from third-party provider
 * @param plan - plan object containing externalPlanId and other details
 * @param user - user object (for email / name etc.)
 * @param thirdPartyToken - { Authorization: `Bearer <token>` }
 */
export const createEsimFromThirdParty = async (
    plan: any,
    user: any,
    thirdPartyToken: { Authorization: string }
): Promise<CreateEsimResponse> => {
    try {
        if (!plan?.externalPlanId) {
            return { success: false, error: "Missing externalPlanId in plan" };
        }

        // Construct request body as expected by the 3rd-party API
        const payload = {
            plan_id: plan.externalPlanId,
            customer_email: user.email,
            customer_name: `${user.firstName || ""} ${user.lastName || ""}`.trim(),
        };

        // Make API call
        const response = await axios.post(
            "https://api.thirdparty-esim.com/v1/esim/order", // replace with real endpoint
            payload,
            { headers: thirdPartyToken }
        );

        console.log(" ✅ ----- response in the posting esim ---- ✅ ", response)
        console.log(" ✅ ------------------------------------------- ✅ ")
        // ✅ Handle success
        if (response.data && response.data.data) {
            const data = response.data.data;
            return {
                success: true,
                data: {
                    externalId: data.id || data.order_id,
                    iccid: data.iccid,
                    qrCodeUrl: data.qr_code_url,
                    ...data,
                },
            };
        }

        // ⚠️ If API response structure is unexpected
        return {
            success: false,
            error: "Invalid response from third-party API",
        };
    } catch (error: any) {
        console.error("Third-party eSIM API error:", error.response?.data || error.message);

        return {
            success: false,
            error: error.response?.data?.message || error.message || "Unknown error",
        };
    }
};

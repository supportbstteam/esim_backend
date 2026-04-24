import axios from "axios";

export const reserveSim = async ({
  planId,
  token,
}: {
  planId: number;
  token: string;
}) => {

  if (process.env.ESIM_TEST_MODE === "true") {
    console.log(`[TEST MODE] Mocking eSIM purchase for planId: ${planId}`);
    return {
      id: `mock-sim-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      iccid: `${Math.floor(1000000000000000000 + Math.random() * 9000000000000000000)}`,
      qr_code_url: "https://www.esimaero.com/sample-qr-code",
      network_status: "NOT_ACTIVE",
      status_text: "Reserved (Test Mode)",
      name: `Test Plan ${planId}`,
      currency: "USD",
      price: "10.00",
      
      validity_days: 30,
      data: 5120, // 5GB
      call: 0,
      sms: 0,
    };
  }

  
  try {
    const response: any = await axios.get(
      `${process.env.TURISM_URL}/v2/sims/reserve?product_plan_id=${planId}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    // console.log("Reserve SIM response:", response.data);

    if (response?.data?.status === "success" && response?.data?.data === null) {
      return {
        message:
          "No SIMs available for the selected plan. Please try again later.",
        reserveId: null,
        status: "error",
      };
    }

    const reserveId = {
      reserveId: response?.data?.data?.reserve_id,
      message: response?.data?.message || "SIM reserved successfully",
      status: response?.data?.status || "success",
    };

    return reserveId;
  } catch (err: any) {
    console.log("Error in the reserseSim", err);

    const errorMessage =
      err?.response?.data?.message ||
      err?.message ||
      "No SIMs available for the selected plan. Please try again later.";

    return {
      message: errorMessage,
      reserveId: null,
      status: "error",
    };
  }
};

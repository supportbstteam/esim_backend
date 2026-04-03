import axios from "axios";

export const reserveSim = async ({
  planId,
  token,
}: {
  planId: number;
  token: string;
}) => {
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

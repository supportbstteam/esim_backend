import { Response } from "express";
import axios from "axios";

export const getOperatorPlans = async (req: any, res: Response) => {
  try {
    const { id, role } = req.user;

    // Validate user
    if (!id || role !== "admin") {
      return res.status(403).json({ message: "Unauthorized access" });
    }

    // Fetch operator plans from external API
    const response = await axios.get(
      "https://www.kwikapi.com/api/v2/operator_codes.php?api_key=aa5af5-4ef9eb-77604d-9bd904-c81337"
    );

    // Extract only the data from axios response
    const plans = response.data;

    if (!plans || (Array.isArray(plans) && plans.length === 0)) {
      return res.status(404).json({ message: "No plans found" });
    }

    res.status(200).json({
      message: "Plans fetched successfully",
      data: plans, // only the data part
    });
  } catch (error: any) {
    console.error("Error fetching operator plans:", error);

    // Send only the error message to avoid circular references
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

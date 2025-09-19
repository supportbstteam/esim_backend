import { Request, Response } from "express";
import mongoose from "mongoose";
import adminModel from "../../../models/admin/adminModel";
import PlanModel from "../../../models/PlanModel";

// Helper to verify admin
const isAdmin = async (userId: string) => {
  const admin = await adminModel.findById(userId);
  return admin !== null;
};

// ✅ CREATE PLAN (admin only)
export const createPlan = async (req: any, res: Response) => {
  try {
    const { id } = req.user as { id: string };
    if (!id || !(await isAdmin(id))) {
      return res.status(403).json({ message: "Only admins can create plans" });
    }

    const {
      name,
      dataLimit,
      validity,
      price,
      nationalCalls,
      internationalCalls,
      operators,
      country,
    } = req.body;

    // Validate country and operators
    if (!mongoose.Types.ObjectId.isValid(country)) {
      return res.status(400).json({ message: "Invalid country ID" });
    }
    if (!Array.isArray(operators) || !operators.every((o: string) => mongoose.Types.ObjectId.isValid(o))) {
      return res.status(400).json({ message: "Invalid operators array" });
    }

    const existing = await PlanModel.findOne({ name, isDeleted: false });
    if (existing) {
      return res.status(400).json({ message: "Plan with this name already exists" });
    }

    const newPlan = new PlanModel({
      name,
      dataLimit,
      validity,
      price,
      nationalCalls: nationalCalls || "0",
      internationalCalls: internationalCalls || "0",
      operators,
      country,
    });

    await newPlan.save();
    res.status(201).json({ message: "Plan created successfully", data: newPlan });
  } catch (err: any) {
    console.error("Error creating Plan:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ✅ UPDATE PLAN (admin only)
export const updatePlan = async (req: any, res: Response) => {
  try {
    const { id: userId } = req.user as { id: string };
    if (!userId || !(await isAdmin(userId))) {
      return res.status(403).json({ message: "Only admins can update plans" });
    }

    const { id } = req.params;
    const {
      name,
      dataLimit,
      validity,
      price,
      nationalCalls,
      internationalCalls,
      operators,
      country,
    } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid Plan ID" });
    }

    // Optional validation
    if (country && !mongoose.Types.ObjectId.isValid(country)) {
      return res.status(400).json({ message: "Invalid country ID" });
    }
    if (operators && (!Array.isArray(operators) || !operators.every((o: string) => mongoose.Types.ObjectId.isValid(o)))) {
      return res.status(400).json({ message: "Invalid operators array" });
    }

    const updated = await PlanModel.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { name, dataLimit, validity, price, nationalCalls, internationalCalls, operators, country },
      { new: true }
    );

    if (!updated) return res.status(404).json({ message: "Plan not found" });

    res.status(200).json({ message: "Plan updated successfully", data: updated });
  } catch (err: any) {
    console.error("Error updating plan:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ✅ SOFT DELETE PLAN (admin only)
export const deletePlan = async (req: any, res: Response) => {
  try {
    const { id: userId } = req.user as { id: string };
    if (!userId || !(await isAdmin(userId))) {
      return res.status(403).json({ message: "Only admins can delete plans" });
    }

    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid Plan ID" });
    }

    const deleted = await PlanModel.findByIdAndUpdate(id, { isDeleted: true }, { new: true });
    if (!deleted) return res.status(404).json({ message: "Plan not found" });

    res.status(200).json({ message: "Plan soft deleted successfully" });
  } catch (err: any) {
    console.error("Error deleting plan:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ✅ GET ALL PLANS
export const getAllPlans = async (req: any, res: Response) => {
  try {
    const plans = await PlanModel.find({ isDeleted: false })
      .populate("operators", "name") // populate operators name
      .populate("country", "name"); // populate country name

    res.status(200).json({ message: "Plans fetched successfully", data: plans });
  } catch (err: any) {
    console.error("Error fetching plans:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ✅ GET PLAN BY ID
export const getPlanById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid Plan ID" });
    }

    const plan = await PlanModel.findOne({ _id: id, isDeleted: false })
      .populate("operators", "name")
      .populate("country", "name");

    if (!plan) return res.status(404).json({ message: "Plan not found" });

    res.status(200).json({ message: "Plan fetched successfully", data: plan });
  } catch (err: any) {
    console.error("Error fetching plan:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

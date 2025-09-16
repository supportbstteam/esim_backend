import { Request, Response } from "express";
import mongoose from "mongoose";
import simModel from "../../../models/simModel";
import adminModel from "../../../models/admin/adminModel";
const isAdmin = async (userId: string) => {
  const admin = await adminModel.findById(userId);
  return admin !== null;
};

export const createESim = async (req: any, res: Response) => {
  try {
    const { id } = req.user as { id: string }; // logged-in user ID
    const admin = await isAdmin(id);

    let {
      simNumber,
      countryName,
      countryCode,
      startDate,
      endDate,
      company,
      plans,
      assignedTo,
    } = req.body;

    // Check if SIM number already exists
    const existing = await simModel.findOne({ simNumber });
    if (existing) {
      return res.status(400).json({ message: "SIM number already exists" });
    }

    // If admin, startDate, endDate, assignedTo are optional
    if (admin) {
      startDate = startDate || null;
      endDate = endDate || null;
      assignedTo = assignedTo || null;
    } else {
      // For non-admin users, these fields are required
      if (!startDate || !endDate) {
        return res.status(400).json({ message: "startDate and endDate are required" });
      }
    }

    const newESim = new simModel({
      simNumber,
      countryName,
      countryCode,
      startDate,
      endDate,
      company,
      plans: plans || [],
      assignedTo,
    });

    await newESim.save();
    res.status(201).json({ message: "E-SIM created successfully", data: newESim });
  } catch (err: any) {
    console.error("Error in creating E-SIM:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ✅ GET ALL E-SIMS
export const getAllESims = async (req: any, res: Response) => {
  try {
    const { id } = req.user as { id: string };
    const admin = await isAdmin(id);

    let filter = { isDeleted: false } as any;

    if (!admin) {
      // Normal user: only see E-SIMs assigned to them
      filter.assignedTo = id;
    }
    // Admin sees all non-deleted E-SIMs (assigned or unassigned)

    const eSims = await simModel.find(filter)
      .populate("assignedTo", "name email")
      .populate("plans")
      .populate("company", "name");

    res.status(200).json({ data: eSims });
  } catch (err: any) {
    console.error("Error fetching E-SIMs:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};


// ✅ GET SINGLE E-SIM BY ID
export const getESimById = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: "Invalid E-SIM ID" });
        }

        const eSim = await simModel.findOne({ _id: id, isDeleted: false })
            .populate("assignedTo", "name email")
            .populate("plans")
            .populate("company", "name");

        if (!eSim) {
            return res.status(404).json({ message: "E-SIM not found" });
        }

        res.status(200).json({ data: eSim });
    } catch (err: any) {
        console.error("Error fetching E-SIM:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
};


// ✅ UPDATE E-SIM
export const updateESim = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: "Invalid E-SIM ID" });
        }

        const updated = await simModel.findByIdAndUpdate(id, req.body, { new: true })
            .populate("assignedTo", "name email")
            .populate("plans")
            .populate("company", "name");

        if (!updated) {
            return res.status(404).json({ message: "E-SIM not found" });
        }

        res.status(200).json({ message: "E-SIM updated successfully", data: updated });
    } catch (err: any) {
        console.error("Error updating E-SIM:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// ✅ DELETE E-SIM
export const deleteESim = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: "Invalid E-SIM ID" });
        }

        const deleted = await simModel.findByIdAndUpdate(
            id,
            { isDeleted: true },
            { new: true }
        );

        if (!deleted) {
            return res.status(404).json({ message: "E-SIM not found" });
        }

        res.status(200).json({ message: "E-SIM soft deleted successfully" });
    } catch (err: any) {
        console.error("Error deleting E-SIM:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

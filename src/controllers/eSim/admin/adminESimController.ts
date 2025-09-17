import { Request, Response } from "express";
import mongoose from "mongoose";
import eSimModel from "../../../models/simModel";
import adminModel from "../../../models/admin/adminModel";
import Country from "../../../models/countryModel";

// Helper: check if user is admin
const isAdmin = async (userId: string) => {
  const admin = await adminModel.findById(userId);
  return admin !== null;
};

// ✅ CREATE E-SIM
export const createESim = async (req: any, res: Response) => {
  try {
    const { id: userId } = req.user as { id: string };
    const admin = await isAdmin(userId);

    let { sims } = req.body; // expecting sims to be an array of objects

    if (!Array.isArray(sims) || sims.length === 0) {
      return res.status(400).json({ message: "Sims array is required" });
    }

    const createdESims = [];

    for (const simData of sims) {
      let { simNumber, countryId, startDate, endDate, company, plans, assignedTo } = simData;

      if (!simNumber || !countryId || !company) {
        return res.status(400).json({ message: "simNumber, countryId, and company are required for each SIM" });
      }

      if (!mongoose.Types.ObjectId.isValid(countryId)) {
        return res.status(400).json({ message: `Invalid countryId for SIM ${simNumber}` });
      }

      const country = await Country.findById(countryId);
      if (!country) {
        return res.status(404).json({ message: `Country not found for SIM ${simNumber}` });
      }

      const existing = await eSimModel.findOne({ simNumber });
      if (existing) {
        return res.status(400).json({ message: `SIM number ${simNumber} already exists` });
      }

      if (admin) {
        startDate = startDate || null;
        endDate = endDate || null;
        assignedTo = assignedTo || null;
      }

      const newESim = new eSimModel({
        simNumber,
        country: country._id,
        startDate,
        endDate,
        company,
        plans: plans || [],
        assignedTo,
      });

      await newESim.save();

      const populatedESim = await eSimModel.findById(newESim._id)
        .populate("country", "name isoCode phoneCode currency")
        .populate("assignedTo", "name email")
        .populate("plans");

      createdESims.push(populatedESim);
    }

    res.status(201).json({ message: "E-SIMs created successfully", data: createdESims });

  } catch (err: any) {
    console.error("Error creating E-SIMs:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ✅ GET ALL E-SIMS
export const getAllESims = async (req: any, res: Response) => {
  try {
    const { id: userId } = req.user as { id: string };
    const admin = await isAdmin(userId);

    const filter: any = { isDeleted: false };

    if (!admin) {
      filter.assignedTo = userId; // normal user sees only assigned E-SIMs
    }

    const eSims = await eSimModel.find(filter)
      .populate("country", "name isoCode phoneCode currency")
      .populate("assignedTo", "name email")
      .populate("plans");

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

    const eSim = await eSimModel.findOne({ _id: id, isDeleted: false })
      .populate("country", "name isoCode phoneCode currency")
      .populate("assignedTo", "name email")
      .populate("plans");

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

    // If countryId is being updated, validate it
    if (req.body.countryId) {
      if (!mongoose.Types.ObjectId.isValid(req.body.countryId)) {
        return res.status(400).json({ message: "Invalid countryId" });
      }
      const country = await Country.findById(req.body.countryId);
      if (!country) {
        return res.status(404).json({ message: "Country not found" });
      }
      req.body.country = req.body.countryId;
      delete req.body.countryId; // remove the raw field
    }

    const updated = await eSimModel.findByIdAndUpdate(id, req.body, { new: true })
      .populate("country", "name isoCode phoneCode currency")
      .populate("assignedTo", "name email")
      .populate("plans");

    if (!updated) {
      return res.status(404).json({ message: "E-SIM not found" });
    }

    res.status(200).json({ message: "E-SIM updated successfully", data: updated });
  } catch (err: any) {
    console.error("Error updating E-SIM:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ✅ DELETE E-SIM (soft delete)
export const deleteESim = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid E-SIM ID" });
    }

    const deleted = await eSimModel.findByIdAndUpdate(
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

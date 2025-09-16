import mongoose, { Schema, Document, Model } from "mongoose";
import "./user/userModel";
import "./PlanModel";

export interface eSimType extends Document {
  simNumber: string;
  countryName: string;
  countryCode: string;
  startDate?: Date;
  endDate?: Date;
  isActive: boolean;
  isDeleted: boolean;
  assignedTo?: mongoose.Types.ObjectId | null; // 👈 nullable
  plans: mongoose.Types.ObjectId[];
  company: string;
}

const eSimSchema = new Schema<eSimType>(
  {
    simNumber: { type: String, required: true, unique: true },
    countryName: { type: String, required: true },
    countryCode: { type: String, required: true },
    startDate: { type: Date, required: false },
    endDate: { type: Date, required: false },
    isActive: { type: Boolean, default: true },
    assignedTo: { type: Schema.Types.ObjectId, ref: "User", default: null }, // nullable
    plans: [{ type: Schema.Types.ObjectId, ref: "Plan" }],
    company: { type: String, required: true },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Prevent OverwriteModelError
const eSim: Model<eSimType> = mongoose.models.eSim || mongoose.model<eSimType>("eSim", eSimSchema);
export default eSim;

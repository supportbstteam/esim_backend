import mongoose, { Schema, Document, Model } from "mongoose";
import "./user/userModel";
import "./PlanModel";
import "./countryModel";
import "./OperatorModel"

export interface eSimType extends Document {
  simNumber: string;
  country: mongoose.Types.ObjectId; // reference to Country
  operator: mongoose.Types.ObjectId; // reference to Country
  startDate?: Date;
  endDate?: Date;
  isActive: boolean;
  isDeleted: boolean;
  assignedTo?: mongoose.Types.ObjectId | null;
  plans: mongoose.Types.ObjectId[];
}

const eSimSchema = new Schema<eSimType>(
  {
    simNumber: { type: String, required: true, unique: true },
    country: { type: Schema.Types.ObjectId, ref: "Country", required: true },
    startDate: { type: Date },
    endDate: { type: Date },
    isActive: { type: Boolean, default: true },
    assignedTo: { type: Schema.Types.ObjectId, ref: "User", default: null },
    plans: [{ type: Schema.Types.ObjectId, ref: "Plan" }],
    operator: { type: Schema.Types.ObjectId, ref: "Operator", required: true },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Prevent OverwriteModelError
const eSim: Model<eSimType> =
  mongoose.models.eSim || mongoose.model<eSimType>("eSim", eSimSchema);

export default eSim;

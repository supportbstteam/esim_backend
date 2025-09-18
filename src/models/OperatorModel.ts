import mongoose, { Schema, Document, Model } from "mongoose";

export interface IOperator extends Document {
  name: string;
  code: string;
  countries: mongoose.Types.ObjectId[];
  // plans: mongoose.Types.ObjectId[];    
  isActive: boolean;
  isDelete: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const OperatorSchema = new Schema<IOperator>(
  {
    name: { type: String, required: true },
    code: { type: String, required: true, unique: true },
    countries: [{ type: Schema.Types.ObjectId, ref: "Country", required: true }],
    // plans: [{ type: Schema.Types.ObjectId, ref: "Plan" }],
    isActive: { type: Boolean, default: true },
    isDelete: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Prevent OverwriteModelError
const Operator: Model<IOperator> =
  mongoose.models.Operator || mongoose.model<IOperator>("Operator", OperatorSchema);

export default Operator;

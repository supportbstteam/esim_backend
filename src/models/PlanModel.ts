import mongoose, { Schema, Document } from "mongoose";

export interface IPlan extends Document {
  name: string;             // Example: "1GB/day for 7 days"
  dataLimit: string;        // Example: "1GB/day"
  validity: string;         // Example: "7 days"
  price: number;            // Price in USD or local currency
  isDeleted: boolean;       // Soft delete flag
  nationalCalls?: string;   // Example: "100 minutes"
  internationalCalls?: string; // Example: "50 minutes"
}

const planSchema = new Schema<IPlan>(
  {
    name: { type: String, required: true },
    dataLimit: { type: String, required: true },
    validity: { type: String, required: true },
    price: { type: Number, required: true },
    nationalCalls: { type: String, default: "0" },
    internationalCalls: { type: String, default: "0" },
    isDeleted: { type: Boolean, default: false } // soft delete flag
  },
  { timestamps: true }
);

export default mongoose.model<IPlan>("Plan", planSchema);

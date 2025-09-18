import mongoose, { Schema, Document } from "mongoose";

export interface IPlan extends Document {
  name: string;                  
  dataLimit: string;             
  validity: string;            
  price: number;                 
  isDeleted: boolean;            
  nationalCalls?: string;       
  internationalCalls?: string;   
  operators: mongoose.Types.ObjectId[]; 
}

const planSchema = new Schema<IPlan>(
  {
    name: { type: String, required: true },
    dataLimit: { type: String, required: true },
    validity: { type: String, required: true },
    price: { type: Number, required: true },
    nationalCalls: { type: String, default: "0" },
    internationalCalls: { type: String, default: "0" },
    isDeleted: { type: Boolean, default: false }, // soft delete flag

    // ✅ link to multiple operators
    operators: [{ type: Schema.Types.ObjectId, ref: "Operator" }],
  },
  { timestamps: true }
);

export default mongoose.models.Plan || mongoose.model<IPlan>("Plan", planSchema);

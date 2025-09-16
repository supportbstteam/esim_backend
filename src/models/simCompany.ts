import mongoose, { Schema, Document } from "mongoose";

export interface CompanyType extends Document {
  name: string;  
  country: string;   
  code: string;     
}

const CompanySchema = new Schema<CompanyType>(
  {
    name: { type: String, required: true },
    country: { type: String, required: true },
    code: { type: String, required: true, unique: true },
  },
  { timestamps: true }
);

export default mongoose.model<CompanyType>("Company", CompanySchema);

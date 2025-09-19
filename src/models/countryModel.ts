import { Schema, model, Document } from "mongoose";

export interface ICountry extends Document {
  name: string;              // Full country name e.g. "India"
  isoCode: string;           // ISO Alpha-2 code e.g. "IN"
  iso3Code?: string;         // ISO Alpha-3 code e.g. "IND"
  phoneCode: string;         // Country phone code e.g. "+91"
  currency: string;          // Currency code e.g. "INR"
  isActive: boolean;         // Whether country is active in system
  isDelete: boolean;         // Whether country is active in system
  createdAt: Date;
  updatedAt: Date;
}

const CountrySchema = new Schema<ICountry>(
  {
    name: { type: String, required: true },
    isoCode: { type: String, required: true, unique: true },
    iso3Code: { type: String },
    phoneCode: { type: String, required: true },
    currency: { type: String, required: true },
    isActive: { type: Boolean, default: true },
    isDelete: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const Country = model<ICountry>("Country", CountrySchema);

export default Country;

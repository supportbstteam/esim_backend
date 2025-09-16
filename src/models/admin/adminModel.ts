import mongoose, { Schema, Document } from "mongoose";

export interface IAdmin extends Document {
  name: string;
  username: string;
  password: string;
  createdAt: Date;
  updatedAt: Date;
}

const adminSchema = new Schema<IAdmin>(
  {
    name: { type: String, required: true },
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
  },
  { timestamps: true }
);

export default mongoose.model<IAdmin>("Admin", adminSchema);

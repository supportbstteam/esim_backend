import mongoose, { Schema, Document } from "mongoose";

export interface IUser extends Document {
  firstName: string;
  lastName: string;
  dob: Date;
  email: string;
  password: string;
  simId?: string; // can later be ObjectId ref if you make a Sim model
  isBlocked: boolean;
  isDeleted: boolean;
  role:  "user";
}

const userSchema = new Schema<IUser>(
  {
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    dob: { type: Date, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    simId: { type: String, default: null }, // later can be ObjectId ref
    isBlocked: { type: Boolean, default: false },
    isDeleted: { type: Boolean, default: false },
    role: { type: String, enum: ["admin", "user"], default: "user" },
  },
  { timestamps: true }
);

export default mongoose.model<IUser>("User", userSchema);

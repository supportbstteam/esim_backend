import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import adminModel from "../../../models/admin/adminModel";

// Generate JWT
const generateToken = (id: string) => {
  if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET is missing");
  return jwt.sign({ id, role: "admin" }, process.env.JWT_SECRET);
};

// Register Admin
export const registerAdmin = async (req: Request, res: Response) => {
  const { name, username, password } = req.body;

  try {
    const exists = await adminModel.findOne({ username });
    if (exists) return res.status(400).json({ message: "Admin already exists" });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const admin:any = await adminModel.create({ name, username, password: hashedPassword });

    res.status(201).json({
      _id: admin._id,
      name: admin.name,
      username: admin.username,
      status:200,
      token: generateToken(admin._id.toString()),
    });
  } catch (error) {
    console.error("---error in the registeration ----", error);
    res.status(500).json({ message: "Server error", error });
  }
};

// Login Admin
export const loginAdmin = async (req: Request, res: Response) => {
  const { username, password } = req.body;

  try {
    const admin:any = await adminModel.findOne({ username });
    if (!admin) return res.status(400).json({ message: "Invalid credentials" });

    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) return res.status(400).json({ message: "Invalid credentials" });

    res.json({
      _id: admin._id,
      name: admin.name,
      username: admin.username,
      status:200,
      token: generateToken(admin._id.toString()),
    });
  } catch (error) {
    console.log("---error in the login ----", error)
    res.status(500).json({ message: "Server error", error });
  }
};


export const adminDetails = async (req: any, res: Response) => {
  const { id } = req.user;

  if (!id) {
    return res.status(401).json({
      message: "Unauthorized account! Invalid Credentials",
    });
  }

  try {
    // exclude password when fetching
    const admin = await adminModel.findById(id).select("-password");

    if (!admin) {
      return res.status(404).json({
        message: "Admin not found",
      });
    }

    return res.status(200).json({
      message: "Admin details fetched successfully",
      data: admin,
    });
  } catch (err: any) {
    return res.status(500).json({
      message: "Internal Server Error",
      error: err.message || err,
    });
  }
};
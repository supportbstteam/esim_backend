import { AppDataSource } from "../../data-source";
import { Admin } from "../../entity/Admin";
import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { generateToken } from "../../utils/generateToken";

export const loginAdmin = async (req: Request, res: Response) => {
    const { username, password }: any = req.body;

    try {
        const adminRepo = AppDataSource.getRepository(Admin);

        // Find admin by username
        const admin = await adminRepo.findOne({ where: { username } });
        if (!admin) {
            return res.status(401).json({ message: "Invalid username or password" });
        }

        // Compare password
        const isMatch = await bcrypt.compare(password, admin.password);
        if (!isMatch) {
            return res.status(401).json({ message: "Invalid username or password" });
        }

        const token = await generateToken(admin.id.toString(), "admin")

        console.log("---- token ----", token);

        // Return success with token
        res.status(200).json({
            id: admin.id,
            name: admin.name,
            username: admin.username,
            status: 200,
            token,
        });
    } catch (error) {
        console.error("---Error in admin login---", error);
        res.status(500).json({ message: "Server error", error });
    }
};


export const registerAdmin = async (req: Request, res: Response) => {
    const { name, username, password }: any = req.body;

    try {
        // console.log("---- data ----", name, username, password);
        const adminRepo = AppDataSource.getRepository(Admin);

        // Check if admin exists
        const exists = await adminRepo.findOne({ where: { username } });
        // console.log("---- exists ----", exists);
        if (exists) {
            return res.status(400).json({ message: "Admin already exists" });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Create and save admin
        const admin = adminRepo.create({ name, username, password: hashedPassword });
        await adminRepo.save(admin);

        // Send response with JWT
        res.status(201).json({
            id: admin.id,
            name: admin.name,
            username: admin.username,
            status: 201,
            token: generateToken(admin.id.toString(), "role"),
        });

    } catch (error) {
        console.error("---Error in admin registration---", error);
        res.status(500).json({ message: "Server error", error });
    }
};


export const adminDetails = async (req: any, res: Response) => {
    try {
        // Assuming middleware decoded JWT and attached `req.user`
        // e.g. req.user = { id, role }

        console.log("-----")
        const adminRepo = AppDataSource.getRepository(Admin);
        const admin = await adminRepo.findOne({ where: { id: req.user.id } });

        if (!admin) {
            return res.status(404).json({ message: "Admin not found" });
        }

        res.status(200).json({
            id: admin.id,
            name: admin.name,
            username: admin.username,
            status: 200,
        });
    } catch (error) {
        console.error("---Error in fetching admin details---", error);
        res.status(500).json({ message: "Server error", error });
    }
};
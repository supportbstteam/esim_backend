import { AppDataSource } from "../../data-source";
import { Admin } from "../../entity/Admin";
import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { generateToken } from "../../utils/generateToken";

export const loginAdmin = async (req: Request, res: Response) => {
    const { username, password }: any = req.body;

    try {
        const adminRepo = AppDataSource.getRepository(Admin);
        const admin = await adminRepo.findOne({ where: { username } });
        if (!admin) return res.status(401).json({ message: "Invalid username or password" });

        const isMatch = await bcrypt.compare(password, admin.password);
        if (!isMatch) return res.status(401).json({ message: "Invalid username or password" });

        const token = generateToken(admin.id.toString(), "admin");

        res.status(200).json({
            id: admin.id,
            name: admin.name,
            username: admin.username,
            status: 200,
            token,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error", error });
    }
};

export const registerAdmin = async (req: Request, res: Response) => {
    const { name, username, password }: any = req.body;

    try {
        const adminRepo = AppDataSource.getRepository(Admin);
        const exists = await adminRepo.findOne({ where: { username } });
        if (exists) return res.status(400).json({ message: "Admin already exists" });

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const admin = adminRepo.create({ name, username, password: hashedPassword });
        await adminRepo.save(admin);

        res.status(201).json({
            id: admin.id,
            name: admin.name,
            username: admin.username,
            status: 201,
            token: generateToken(admin.id.toString(), "admin"),
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error", error });
    }
};

export const adminDetails = async (req: any, res: Response) => {
    try {
        const adminRepo = AppDataSource.getRepository(Admin);
        const admin = await adminRepo.findOne({ where: { id: req.user.id } });
        if (!admin) return res.status(404).json({ message: "Admin not found" });

        res.status(200).json({
            id: admin.id,
            name: admin.name,
            username: admin.username,
            status: 200,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error", error });
    }
};

import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { AppDataSource } from "../../data-source";
import { User } from "../../entity/User";

// ⚙️ Helper to generate JWT
const generateToken = (user: User) => {
    return jwt.sign(
        { id: user.id, role: user.role },
        process.env.JWT_SECRET as string,
        // { expiresIn: "7d" }
    );
};

// 📝 SIGNUP
export const postCreateUser = async (req: Request, res: Response) => {

    console.log("--- sign up ---");
    try {
        const { firstName, lastName, email, password } = req.body;

        if (!firstName || !lastName || !email || !password) {
            return res.status(400).json({ message: "All fields are required" });
        }

        const userRepo = AppDataSource.getRepository(User);

        // Check if email already exists
        const existingUser = await userRepo.findOneBy({ email });
        if (existingUser) {
            return res.status(409).json({ message: "Email already registered" });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create user
        const newUser = userRepo.create({
            firstName,
            lastName,
            email,
            password: hashedPassword,
        });

        await userRepo.save(newUser);

        return res.status(201).json({
            message: "User registered successfully",
            data: {
                id: newUser.id,
                firstName: newUser.firstName,
                lastName: newUser.lastName,
                email: newUser.email,
                // dob: newUser.dob,
                role: newUser.role,
            },
            token: generateToken(newUser),
        });
    } catch (err: any) {
        console.error("--- Error in signup ---", err.message);
        return res.status(500).json({ message: "Signup failed", error: err.message });
    }
};

// 🔑 LOGIN
export const postUserLogin = async (req: Request, res: Response) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: "Email and password are required" });
        }

        const userRepo = AppDataSource.getRepository(User);

        const user = await userRepo.findOneBy({ email });
        if (!user) {
            return res.status(404).json({ message: "Invalid credentials" });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ message: "Invalid credentials" });
        }

        return res.status(200).json({
            message: "Login successful",
            data: {
                id: user.id,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                role: user.role,
            },
            token: generateToken(user),
        });
    } catch (err: any) {
        console.error("--- Error in login ---", err.message);
        return res.status(500).json({ message: "Login failed", error: err.message });
    }
};

// 👤 GET USER DETAILS (requires JWT)
export const getUserDetails = async (req: any, res: Response) => {
    try {
        const userRepo = AppDataSource.getRepository(User);
        const user = await userRepo.findOne({
            where: { id: req.user.id }, // req.user is set in auth middleware
            relations: ["simIds"], // load related sims if needed
        });

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        return res.status(200).json({
            id: user.id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            dob: user.dob,
            role: user.role,
            isBlocked: user.isBlocked,
            isDeleted: user.isDeleted,
            sims: user.simIds,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
        });
    } catch (err: any) {
        console.error("--- Error in getUserDetails ---", err.message);
        return res.status(500).json({ message: "Failed to get user details", error: err.message });
    }
};

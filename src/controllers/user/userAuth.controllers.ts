import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { AppDataSource } from "../../data-source";
import { User } from "../../entity/User.entity";
import { sendOtpEmail } from "../../utils/email";

// ⚙️ Helper to generate JWT for User
const generateToken = (user: User) => {
    return jwt.sign(
        { id: user.id, role: user.role },
        process.env.JWT_SECRET as string,
        // { expiresIn: "7d" }
    );
};

// 📝 SIGNUP
export const postCreateUser = async (req: Request, res: Response) => {
    try {
        const { firstName, lastName, email, password } = req.body;
        if (!firstName || !lastName || !email || !password) {
            return res.status(400).json({ message: "All fields are required" });
        }

        const userRepo = AppDataSource.getRepository(User);
        const existingUser = await userRepo.findOneBy({ email });
        if (existingUser) return res.status(409).json({ message: "Email already registered" });

        const hashedPassword = await bcrypt.hash(password, 10);

        // Generate OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit
        const otpExpires = Date.now() + 10 * 60 * 1000; // 10 minutes

        const newUser = userRepo.create({
            firstName,
            lastName,
            email,
            password: hashedPassword,
            otp,
            otpExpires,
        });
        await userRepo.save(newUser);

        await sendOtpEmail(email, otp); // send OTP email

        return res.status(201).json({ message: "User registered, OTP sent to email", email });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: "Signup failed", error: err });
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

        // Check if email is verified
        if (!user.isVerified) {
            return res.status(403).json({ message: "Please verify your email before logging in" });
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

export const postVerifyOtp = async (req: Request, res: Response) => {
    try {
        const { email, otp } = req.body;
        if (!email || !otp) return res.status(400).json({ message: "Email and OTP required" });

        const userRepo = AppDataSource.getRepository(User);
        const user = await userRepo.findOneBy({ email });

        if (!user) return res.status(404).json({ message: "User not found" });
        if (user.otp !== otp) return res.status(400).json({ message: "Invalid OTP" });
        if (user.otpExpires! < Date.now()) return res.status(400).json({ message: "OTP expired" });

        // OTP verified → clear OTP fields
        user.isVerified = true;
        user.otp = null;
        user.otpExpires = null;
        await userRepo.save(user);

        return res.status(200).json({ message: "Email verified successfully" });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: "OTP verification failed", error: err });
    }
};

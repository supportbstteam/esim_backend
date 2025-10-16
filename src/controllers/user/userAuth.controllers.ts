import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { AppDataSource } from "../../data-source";
import { User } from "../../entity/User.entity";
import { sendOtpEmail } from "../../utils/email";

// ⚙️ Helper to generate JWT for User
const generateToken = (user: User) => {
    return jwt.sign(
        { id: user.id, role: "user" },
        process.env.JWT_SECRET as string,
        // { expiresIn: "7d" }
    );
};

// 📝 SIGNUP
export const postCreateUser = async (req: Request, res: Response) => {
    const { firstName, lastName, email, password } = req.body;

    if (!firstName || !lastName || !email || !password) {
        return res.status(400).json({ message: "All fields are required" });
    }

    const userRepo = AppDataSource.getRepository(User);

    try {
        const existingUser = await userRepo.findOne({ where: { email } });

        if (existingUser) {
            if (existingUser.isDeleted) {
                // Previously deleted → allow re-register
                const hashedPassword = await bcrypt.hash(password, 10);
                const otp = Math.floor(100000 + Math.random() * 900000).toString();
                const otpExpires = Date.now() + 10 * 60 * 1000; // 10 mins

                existingUser.firstName = firstName;
                existingUser.lastName = lastName;
                existingUser.password = hashedPassword;
                existingUser.otp = otp;
                existingUser.otpExpires = otpExpires;
                existingUser.isDeleted = false;
                existingUser.isVerified = false;

                await userRepo.save(existingUser);

                await sendOtpEmail(email, otp);

                return res.status(201).json({ message: "User re-registered, OTP sent to email", email });
            }

            if (existingUser.isVerified) {
                // Already verified → cannot register again
                return res.status(409).json({ message: "Email already registered" });
            } else {
                // Not verified → resend OTP
                const otp = Math.floor(100000 + Math.random() * 900000).toString();
                const otpExpires = Date.now() + 10 * 60 * 1000;

                existingUser.otp = otp;
                existingUser.otpExpires = otpExpires;

                await userRepo.save(existingUser);
                await sendOtpEmail(email, otp);

                return res.status(200).json({ message: "OTP resent to email", email });
            }
        }

        // New user → create account
        const hashedPassword = await bcrypt.hash(password, 10);
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const otpExpires = Date.now() + 10 * 60 * 1000;

        await AppDataSource.manager.transaction(async (transactionalEntityManager) => {
            const newUser = transactionalEntityManager.create(User, {
                firstName,
                lastName,
                email,
                password: hashedPassword,
                otp,
                otpExpires,
            });

            await transactionalEntityManager.save(newUser);
            await sendOtpEmail(email, otp);
        });

        return res.status(201).json({ message: "User registered, OTP sent to email", email });

    } catch (err: any) {
        console.error("--- Error in postCreateUser ---", err);
        return res.status(500).json({ message: "Signup failed", error: err.message || err });
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

        console.log("---- user ----", user);

        if (!user) {
            return res.status(404).json({ message: "Invalid credentials" });
        }

        // 🚫 Check if user account is deleted
        if (user.isDeleted) {
            return res.status(403).json({
                message: "Your account has been deleted. Please contact support for assistance.",
            });
        }

        // 🚫 Check if email is verified
        if (!user.isVerified) {
            return res.status(403).json({
                message: "Please verify your email before logging in",
            });
        }

        // 🚫 Check if email is verified
        if (!user.isBlocked) {
            return res.status(403).json({
                message: "Action forbidden: user is currently not blocked.",
            });
        }


        // 🔐 Check password validity
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ message: "Invalid credentials" });
        }

        // ✅ Successful login
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
    console.log("---- fetch user details ------");
    try {
        const userRepo = AppDataSource.getRepository(User);

        const { id } = req.user;

        console.log("----- id -----", id);

        // Find user by ID, including related sims
        const user = await userRepo.findOne({
            where: { id: (req as any).user.id }, // req.user added by auth middleware
            relations: ["simIds", "carts"], // include carts if needed
        });

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        // 🚫 Block if user is deleted
        if (user.isDeleted) {
            return res.status(403).json({
                message: "Your account has been deleted. Please contact support for assistance.",
            });
        }

        return res.status(200).json({
            id: user.id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            role: user.role,
            isBlocked: user.isBlocked,
            isDeleted: user.isDeleted,
            isVerified: user.isVerified,
            sims: user.simIds,
            carts: user.carts,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
        });
    } catch (err: any) {
        console.error("--- Error in getUserDetails ---", err.message);
        return res.status(500).json({ message: "Failed to get user details", error: err.message });
    }
};

// UPDATE USER DETAILS
export const updateProfile = async (req: any, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ message: "Unauthorized access" });
        }

        const userRepo = AppDataSource.getRepository(User);
        const user = await userRepo.findOne({ where: { id: userId } });

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        const { firstName, lastName, email } = req.body;

        // Allow updating only these fields
        if (firstName !== undefined) user.firstName = firstName.trim();
        if (lastName !== undefined) user.lastName = lastName.trim();
        if (email !== undefined) user.email = email.trim();

        await userRepo.save(user);

        return res.status(200).json({
            message: "Profile updated successfully",
            status: "success",
            user: {
                id: user.id,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                role: user.role,
                isBlocked: user.isBlocked,
                isDeleted: user.isDeleted,
                createdAt: user.createdAt,
                updatedAt: user.updatedAt,
            },
        });
    } catch (err: any) {
        console.error("--- Error in updateProfile ---", err.message);
        return res
            .status(500)
            .json({ message: "Failed to update profile", error: err.message });
    }
};

// DELETE USER ACCOUNT
export const deleteAccount = async (req: any, res: Response) => {
    try {
        const userId = req.user?.id;

        if (!userId) {
            return res.status(401).json({ message: "Unauthorized access" });
        }

        const userRepo = AppDataSource.getRepository(User);
        const user = await userRepo.findOne({ where: { id: userId } });

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        if (user.isDeleted) {
            return res.status(400).json({ message: "Account already deleted" });
        }

        user.isDeleted = true;
        await userRepo.save(user);

        return res.status(200).json({ message: "Account deleted successfully", status: "success" });
    } catch (err: any) {
        console.error("--- Error in deleteAccount ---", err.message);
        return res
            .status(500)
            .json({ message: "Failed to delete account", error: err.message });
    }
};

// export const postOtpVerification = async

export const postVerifyOtp = async (req: Request, res: Response) => {
    try {
        const { email, otp } = req.body;
        if (!email || !otp) {
            return res.status(400).json({ message: "Email and OTP required" });
        }

        const userRepo = AppDataSource.getRepository(User);
        const user = await userRepo.findOneBy({ email });

        if (!user) return res.status(404).json({ message: "User not found" });
        if (user.otp !== otp) return res.status(400).json({ message: "Invalid OTP" });
        if (user.otpExpires! < Date.now()) return res.status(400).json({ message: "OTP expired" });

        // OTP verified → clear OTP fields and mark user as verified
        user.isVerified = true;
        user.otp = null;
        user.otpExpires = null;
        await userRepo.save(user);

        // Generate JWT token
        const token = generateToken(user);

        return res.status(200).json({
            message: "Email verified successfully",
            data: {
                user,
                token
            }
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: "OTP verification failed", error: err });
    }
};
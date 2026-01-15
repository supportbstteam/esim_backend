import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { AppDataSource } from "../../data-source";
import { User } from "../../entity/User.entity";
import { sendForgotPasswordOtpEmail, sendUserWelcomeEmail, sendOtpEmail, sendPasswordChangeEmail, sendAdminUserVerifiedNotification } from "../../utils/email";
import { Admin } from "../../entity/Admin.entity";
import { isValid } from "../../utils/isValid";

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
    try {
        let { firstName, lastName, email, password } = req.body;

        if (!firstName || !lastName || !email || !password) {
            return res.status(400).json({ message: "All fields are required." });
        }

        email = email.trim().toLowerCase();
        const userRepo = AppDataSource.getRepository(User);

        // 🔍 Fetch only what we need
        const existingUser = await userRepo.findOne({
            where: { email },
            select: ["id", "isDeleted", "isVerified"],
        });

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const otpExpires = Date.now() + 10 * 60 * 1000;

        // ❌ Already verified
        if (existingUser?.isVerified) {
            return res.status(409).json({ message: "Email already registered." });
        }

        // 🔄 Re-register / resend OTP
        if (existingUser) {
            const hashedPassword = await bcrypt.hash(password, 10);

            await userRepo.update(existingUser.id, {
                firstName,
                lastName,
                password: hashedPassword,
                otp,
                otpExpires,
                isDeleted: false,
                isBlocked: true,
                isVerified: false,
            });

            sendOtpEmail(email, otp).catch(console.error);

            return res.status(200).json({
                message: "OTP sent to email.",
                email,
                status: "success"
            });
        }

        // 🆕 New user
        const hashedPassword = await bcrypt.hash(password, 10);

        await userRepo.insert({
            firstName,
            lastName,
            email,
            password: hashedPassword,
            otp,
            otpExpires,
            isBlocked: true,
        });

        sendOtpEmail(email, otp).catch(console.error);

        return res.status(201).json({
            message: "User registered successfully. OTP sent to email.",
            email,
        });
    } catch (err: any) {
        console.error(err);
        return res.status(500).json({ message: "Signup failed" });
    }
};


// -----------------------------
// POST USER LOGIN
// -----------------------------
export const postUserLogin = async (req: Request, res: Response) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ message: "Email and password required" });
        }

        const userRepo = AppDataSource.getRepository(User);
        const user = await userRepo.findOne({
            where: { email },
            select: [
                "id",
                "firstName",
                "lastName",
                "email",
                "password",
                "role",
                "isBlocked",
                "isDeleted",
                "isVerified",
            ],
        });

        if (!user || user.isDeleted || user.isBlocked || !user.isVerified) {
            return res.status(401).json({ message: "Invalid credentials" });
        }

        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) {
            return res.status(401).json({ message: "Invalid credentials" });
        }

        return res.status(200).json({
            message: "Login successful",
            token: generateToken(user),
            data: {
                id: user.id,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                role: user.role,
            },
        });
    } catch (err: any) {
        console.error(err);
        return res.status(500).json({ message: "Login failed" });
    }
};

// -----------------------------
// GET USER DETAILS (requires JWT)
// -----------------------------
export const getUserDetails = async (req: any, res: Response) => {
    // // console.log("---- fetch user details ------");
    try {
        const userRepo = AppDataSource.getRepository(User);

        const { id } = req.user; // Added by auth middleware

        // Find user by ID, including related sims and carts
        const user = await userRepo.findOne({
            where: { id },
            // relations: ["simIds", "carts"],
        });

        if (!user || user.isDeleted || user.isBlocked || !user.isVerified) {
            return res.status(401).json({ message: "Invalid credentials" });
        }

        return res.status(200).json({
            id: user.id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            role: user.role,
            phone: user?.phone,
            country: user?.country,
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

        const {
            firstName,
            lastName,
            email,
            phone,
            country,
            password, // new password
            currentPassword, // old password to verify
        } = req.body;

        // ✅ Update non-sensitive fields
        if (firstName !== undefined) user.firstName = firstName.trim();
        if (lastName !== undefined) user.lastName = lastName.trim();
        if (email !== undefined) user.email = email.trim().toLowerCase();
        if (phone !== undefined) user.phone = phone.toString().trim();
        if (country !== undefined) user.country = country.trim();

        // ✅ Password update with verification
        if (password) {
            if (!currentPassword) {
                // console.log("-=-=-=-= current password in not set -=-=-=-=-=");
                return res.status(400).json({
                    message: "Current password is required to set a new password",
                });
            }

            const isMatch = await bcrypt.compare(currentPassword, user.password);
            if (!isMatch) {
                // console.log("-=-=-=-= current password is not matching-=-=-=-=-=");
                return res.status(400).json({ message: "Current password is incorrect" });
            }

            const saltRounds = 10;
            const hashedPassword = await bcrypt.hash(password, saltRounds);
            user.password = hashedPassword;
            // ✅ Send confirmation mail after successful change
            await sendPasswordChangeEmail(user.email, user.firstName);
        }

        await userRepo.save(user);

        return res.status(200).json({
            message: "Profile updated successfully",
            status: "success",
            user: {
                id: user.id,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                phone: user.phone,
                country: user.country,
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

        // 🔍 Fetch only required fields
        const user = await userRepo.findOne({
            where: { email },
            select: ["id", "email", "otp", "otpExpires"],
        });

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        if (user.otp !== otp) {
            return res.status(400).json({ message: "Invalid OTP" });
        }

        if (!user.otpExpires || user.otpExpires < Date.now()) {
            return res.status(400).json({ message: "OTP expired" });
        }

        // ⚡ Partial update (fast)
        await userRepo.update(user.id, {
            isVerified: true,
            isBlocked: false,
            otp: null,
            otpExpires: null,
        });

        const token = generateToken(user);

        // 🚀 Non-blocking emails
        sendUserWelcomeEmail(user.email, user).catch(console.error);
        sendAdminUserVerifiedNotification(
            process.env.ADMIN_NOTIFICATION_EMAIL!,
            user
        ).catch(console.error);

        return res.status(200).json({
            message: "Email verified successfully",
            token,
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({
            message: "OTP verification failed",
        });
    }
};

// Request body: { email: string }
export const postForgotPassword = async (req: Request, res: Response) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ message: "Email is required" });
        }

        const userRepo = AppDataSource.getRepository(User);

        // 🔍 Fetch only required fields
        const user = await userRepo.findOne({
            where: { email },
            select: ["id", "email", "isDeleted", "isBlocked"],
        });

        if (!user || user.isDeleted) {
            return res.status(404).json({ message: "User not found" });
        }

        if (user.isBlocked) {
            return res.status(403).json({
                message: "Account is blocked. Contact support.",
            });
        }

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const otpExpires = Date.now() + 10 * 60 * 1000;

        // ⚡ Partial update
        await userRepo.update(user.id, {
            otp,
            otpExpires,
        });

        // 🚀 Non-blocking email
        sendForgotPasswordOtpEmail(user.email, otp).catch(console.error);

        return res.status(200).json({
            message: "OTP sent to your registered email address",
            email: user.email,
        });
    } catch (err: any) {
        console.error("--- Error in postForgotPassword ---", err.message);
        return res.status(500).json({
            message: "Failed to send OTP",
        });
    }
};

// Request body: { email: string, otp: string }
export const postVerifyForgotPasswordOtp = async (req: Request, res: Response) => {
    try {
        const { email, otp } = req.body;

        if (!email || !otp) {
            return res.status(400).json({ message: "Email and OTP are required" });
        }

        const userRepo = AppDataSource.getRepository(User);

        // 🔍 Fetch only what we actually need
        const user = await userRepo.findOne({
            where: { email },
            select: ["id", "otp", "otpExpires", "isDeleted", "isBlocked"],
        });

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        if (user.isDeleted) {
            return res.status(400).json({ message: "Account is deleted" });
        }

        if (user.isBlocked) {
            return res.status(403).json({ message: "Account is blocked" });
        }

        if (user.otp !== otp) {
            return res.status(400).json({ message: "Invalid OTP" });
        }

        if (!user.otpExpires || user.otpExpires < Date.now()) {
            return res.status(400).json({ message: "OTP expired" });
        }

        // ⚡ Partial update ONLY
        await userRepo.update(user.id, {
            otp: null,
            otpExpires: null,
            tempResetAllowed: true,
        });

        return res.status(200).json({
            message: "OTP verified successfully. You can now reset your password.",
        });
    } catch (err: any) {
        console.error("--- Error in postVerifyForgotPasswordOtp ---", err.message);
        return res.status(500).json({
            message: "OTP verification failed",
        });
    }
};


// Request body: { email: string, password: string }
export const postResetPassword = async (req: Request, res: Response) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                message: "Email and new password are required",
            });
        }

        const userRepo = AppDataSource.getRepository(User);

        // 🔍 Fetch only what we need
        const user = await userRepo.findOne({
            where: { email },
            select: ["id", "isDeleted", "tempResetAllowed", "email"],
        });

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        if (user.isDeleted) {
            return res.status(400).json({ message: "Account is deleted" });
        }

        if (!user.tempResetAllowed) {
            return res.status(403).json({
                message: "OTP verification required before reset",
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        // ⚡ Partial update
        await userRepo.update(user.id, {
            password: hashedPassword,
            tempResetAllowed: false,
        });

        // 🚀 Non-blocking email
        sendPasswordChangeEmail(user.email).catch(console.error);

        return res.status(200).json({
            message: "Password reset successfully",
        });
    } catch (err: any) {
        console.error("--- Error in postResetPassword ---", err.message);
        return res.status(500).json({
            message: "Failed to reset password",
        });
    }
};

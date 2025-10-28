import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { AppDataSource } from "../../data-source";
import { User } from "../../entity/User.entity";
import { sendForgotPasswordOtpEmail, sendNewUserNotification, sendOtpEmail, sendPasswordChangeEmail } from "../../utils/email";
import { Admin } from "../../entity/Admin.entity";

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
    let { firstName, lastName, email, password } = req.body;

    if (!firstName || !lastName || !email || !password) {
        return res.status(400).json({ message: "All fields are required." });
    }

    email = email.trim().toLowerCase();

    const userRepo = AppDataSource.getRepository(User);

    try {
        const existingUser = await userRepo.findOne({ where: { email } });

        // 🔁 CASE 1: User existed but marked deleted → allow re-registration
        if (existingUser && existingUser.isDeleted) {
            const hashedPassword = await bcrypt.hash(password, 10);
            const otp = Math.floor(100000 + Math.random() * 900000).toString();
            const otpExpires = Date.now() + 10 * 60 * 1000;

            existingUser.firstName = firstName;
            existingUser.lastName = lastName;
            existingUser.password = hashedPassword;
            existingUser.otp = otp;
            existingUser.otpExpires = otpExpires;
            existingUser.isDeleted = false;
            existingUser.isVerified = false;

            await userRepo.save(existingUser);
            await sendOtpEmail(email, otp);

            return res.status(201).json({
                message: "User re-registered. OTP sent to email.",
                email,
            });
        }

        // ❌ CASE 2: Already verified → cannot register again
        if (existingUser && existingUser.isVerified) {
            return res.status(409).json({
                message: "Email is already registered and verified.",
            });
        }

        // 🔄 CASE 3: Exists but not verified → resend OTP
        if (existingUser && !existingUser.isVerified) {
            const otp = Math.floor(100000 + Math.random() * 900000).toString();
            const otpExpires = Date.now() + 10 * 60 * 1000;

            existingUser.otp = otp;
            existingUser.otpExpires = otpExpires;

            await userRepo.save(existingUser);
            await sendOtpEmail(email, otp);

            return res.status(200).json({
                message: "OTP resent to your email.",
                email,
            });
        }

        // 🆕 CASE 4: Completely new user → create account
        const hashedPassword = await bcrypt.hash(password, 10);
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const otpExpires = Date.now() + 10 * 60 * 1000;

        let newUser;
        await AppDataSource.manager.transaction(async (trx) => {
            newUser = trx.create(User, {
                firstName,
                lastName,
                email,
                password: hashedPassword,
                otp,
                otpExpires,
                isVerified: false,
                isDeleted: false,
            });

            await trx.save(newUser);
        });

        // 📧 Send verification OTP
        await sendOtpEmail(email, otp);


        return res.status(201).json({
            message: "User registered successfully. OTP sent to email.",
            email,
        });

    } catch (err: any) {
        console.error("--- Error in postCreateUser ---", err);
        return res.status(500).json({
            message: "Signup failed. Please try again later.",
            error: err.message || err,
        });
    }
};

// -----------------------------
// POST USER LOGIN
// -----------------------------
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

        // Check if account is deleted
        if (user.isDeleted) {
            return res.status(403).json({
                message: "Your account has been deleted. Please contact support.",
            });
        }

        // Check if email is verified
        if (!user.isVerified) {
            return res.status(403).json({
                message: "Please verify your email before logging in",
            });
        }

        // Check if user is blocked
        if (user.isBlocked) {
            return res.status(403).json({
                message: "Your account is blocked. Please contact support.",
            });
        }

        // Check password
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ message: "Invalid credentials" });
        }

        // Successful login
        return res.status(200).json({
            message: "Login successful",
            data: {
                id: user.id,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                role: user.role,
                isBlocked: user.isBlocked,
                isDeleted: user.isDeleted,
                isVerified: user.isVerified,
            },
            token: generateToken(user),
        });
    } catch (err: any) {
        console.error("--- Error in login ---", err.message);
        return res.status(500).json({ message: "Login failed", error: err.message });
    }
};


// -----------------------------
// GET USER DETAILS (requires JWT)
// -----------------------------
export const getUserDetails = async (req: any, res: Response) => {
    console.log("---- fetch user details ------");
    try {
        const userRepo = AppDataSource.getRepository(User);

        const { id } = req.user; // Added by auth middleware

        // Find user by ID, including related sims and carts
        const user = await userRepo.findOne({
            where: { id },
            relations: ["simIds", "carts"],
        });

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        // Check if account is deleted
        if (user.isDeleted) {
            return res.status(403).json({
                message: "Your account has been deleted. Please contact support.",
            });
        }

        return res.status(200).json({
            id: user.id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            role: user.role,
            phone: user?.phone,
            country: user?.country,
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
                return res.status(400).json({
                    message: "Current password is required to set a new password",
                });
            }

            const isMatch = await bcrypt.compare(currentPassword, user.password);
            if (!isMatch) {
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
        const adminRepo = AppDataSource.getRepository(Admin);
        const user = await userRepo.findOneBy({ email });
        // const admin = await 

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

        const admin: any = await adminRepo.findOne({
            select: ["notificationMail"],
        });

        if (!admin) {
            // 🔔 Notify admin about re-registered user
            await sendNewUserNotification(admin?.notificationMail, user);
        }

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

// Request body: { email: string }
export const postForgotPassword = async (req: Request, res: Response) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ message: "Email is required" });

        const userRepo = AppDataSource.getRepository(User);
        const user = await userRepo.findOne({ where: { email } });

        if (!user || user.isDeleted) {
            return res.status(404).json({ message: "User not found" });
        }

        if (user.isBlocked) {
            return res.status(403).json({ message: "Account is blocked. Contact support." });
        }

        // Generate OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const otpExpires = Date.now() + 10 * 60 * 1000; // 10 min

        user.otp = otp;
        user.otpExpires = otpExpires;
        await userRepo.save(user);

        // Send OTP via email
        await sendForgotPasswordOtpEmail(user.email, otp);

        return res.status(200).json({
            message: "OTP sent to your registered email address",
            email: user.email,
        });
    } catch (err: any) {
        console.error("--- Error in postForgotPassword ---", err.message);
        return res.status(500).json({ message: "Failed to send OTP", error: err.message });
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
        const user = await userRepo.findOne({ where: { email } });

        if (!user) return res.status(404).json({ message: "User not found" });
        if (user.otp !== otp) return res.status(400).json({ message: "Invalid OTP" });
        if (user.otpExpires! < Date.now()) return res.status(400).json({ message: "OTP expired" });

        // OTP verified → clear otp fields, mark as verified-for-reset
        user.otp = null;
        user.otpExpires = null;
        user.tempResetAllowed = true; // <-- optional boolean column for security (recommended)
        await userRepo.save(user);

        return res.status(200).json({
            message: "OTP verified successfully. You can now reset your password.",
        });
    } catch (err: any) {
        console.error("--- Error in postVerifyForgotPasswordOtp ---", err.message);
        return res.status(500).json({ message: "OTP verification failed", error: err.message });
    }
};

// Request body: { email: string, password: string }
export const postResetPassword = async (req: Request, res: Response) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ message: "Email and new password are required" });
        }

        const userRepo = AppDataSource.getRepository(User);
        const user = await userRepo.findOne({ where: { email } });

        if (!user) return res.status(404).json({ message: "User not found" });
        if (user.isDeleted) return res.status(400).json({ message: "Account is deleted" });

        // Optional: only allow if OTP was verified (if you added tempResetAllowed)
        if (!user.tempResetAllowed) {
            return res.status(403).json({ message: "OTP verification required before reset" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        user.password = hashedPassword;
        user.tempResetAllowed = false;
        await userRepo.save(user);

        // Send confirmation email
        await sendPasswordChangeEmail(user.email, user.firstName);

        return res.status(200).json({
            message: "Password reset successfully",
        });
    } catch (err: any) {
        console.error("--- Error in postResetPassword ---", err.message);
        return res.status(500).json({ message: "Failed to reset password", error: err.message });
    }
};

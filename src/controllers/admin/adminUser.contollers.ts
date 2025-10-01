import { Request, Response } from "express";
import { User } from "../../entity/User.entity";
import { getDataSource } from "../../lib/serverless";
import { checkAdmin } from "../../utils/checkAdmin";
import bcrypt from "bcryptjs";

// ----------------- CREATE USER -----------------
export const postAdminCreateUser = async (req: Request, res: Response) => {
    const { firstName, lastName, email, password, role } = req.body;

    try {
        const isAdmin = await checkAdmin(req, res);
        if (!isAdmin) return;

        if (!firstName || !lastName || !email || !password) {
            return res.status(400).json({ message: "All fields are required" });
        }

        const dataSource = await getDataSource();
        const userRepo = dataSource.getRepository(User);

        const existingUser = await userRepo.findOne({ where: { email } });
        if (existingUser) {
            return res.status(400).json({ message: "User already exists with this email" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = userRepo.create({
            firstName,
            lastName,
            email,
            password: hashedPassword,
            isVerified: true,
            role: role || "user",
        });

        await userRepo.save(newUser);

        // exclude password
        const { password: _, ...safeUser } = newUser;

        return res.status(201).json({
            message: "User created successfully",
            user: safeUser,
        });
    } catch (err: any) {
        console.error("Error creating user by admin:", err);
        return res.status(500).json({ message: "Internal server error" });
    }
};

// ----------------- SOFT DELETE USER -----------------
export const deleteAdminUser = async (req: Request, res: Response) => {
    const { userId } = req.params;

    try {
        const isAdmin = await checkAdmin(req, res);
        if (!isAdmin) return;

        const dataSource = await getDataSource();
        const userRepo = dataSource.getRepository(User);

        const user = await userRepo.findOne({ where: { id: userId } });
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        user.isDeleted = true;
        await userRepo.save(user);

        return res.status(200).json({ message: "User soft deleted successfully" });
    } catch (err: any) {
        console.error("Error soft deleting user:", err);
        return res.status(500).json({ message: "Internal server error" });
    }
};

// ----------------- TOGGLE BLOCK/UNBLOCK USER -----------------
export const patchAdminToggleBlockUser = async (req: Request, res: Response) => {
    const { userId } = req.params;

    try {
        const isAdmin = await checkAdmin(req, res);
        if (!isAdmin) return;

        const dataSource = await getDataSource();
        const userRepo = dataSource.getRepository(User);

        const user = await userRepo.findOne({ where: { id: userId } });
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        // ✅ toggle the value
        user.isBlocked = !user.isBlocked;
        await userRepo.save(user);

        return res.status(200).json({
            message: `User ${user.isBlocked ? "blocked" : "unblocked"} successfully`,
            userId: user.id,
            isBlocked: user.isBlocked,
        });
    } catch (err: any) {
        console.error("Error toggling block/unblock user:", err);
        return res.status(500).json({ message: "Internal server error" });
    }
};


// ----------------- GET ALL USERS WITH FILTERS -----------------
export const getAdminAllUsers = async (req: Request, res: Response) => {
    try {
        const isAdmin = await checkAdmin(req, res);
        if (!isAdmin) return;

        const { countryId, planId } = req.query;

        const dataSource = await getDataSource();
        const userRepo = dataSource.getRepository(User);

        let query = userRepo
            .createQueryBuilder("user")
            .leftJoinAndSelect("user.simIds", "esim")
            .leftJoinAndSelect("esim.country", "country")
            .leftJoinAndSelect("esim.plans", "plan")
            .leftJoinAndSelect("esim.topUps", "topUps")
            .where("user.isDeleted = :isDeleted", { isDeleted: false })
            .orderBy("user.createdAt", "DESC");

        if (countryId) {
            query = query.andWhere("country.id = :countryId", { countryId });
        }
        if (planId) {
            query = query.andWhere("plan.id = :planId", { planId });
        }

        const users = await query.getMany();

        // remove password from each user
        const safeUsers = users.map((u) => {
            const { password, ...rest } = u;
            return rest;
        });

        return res.status(200).json({
            message: "Users fetched successfully",
            filters: { countryId, planId },
            users: safeUsers,
        });
    } catch (err: any) {
        console.error("Error fetching users:", err);
        return res.status(500).json({ message: "Internal server error" });
    }
};

// ----------------- GET SINGLE USER DETAILS + STATS -----------------
export const getAdminUserDetails = async (req: Request, res: Response) => {
    const { userId } = req.params;

    try {
        const isAdmin = await checkAdmin(req, res);
        if (!isAdmin) return;

        const dataSource = await getDataSource();
        const userRepo = dataSource.getRepository(User);

        const user = await userRepo.findOne({
            where: { id: userId },
            relations: ["simIds", "simIds.country", "simIds.plans", "simIds.topUps"],
        });

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        // aggregate stats
        const totalEsims = user.simIds.length;
        const totalPlans = user.simIds.reduce((sum, esim) => sum + esim.plans.length, 0);
        const totalTopUps = user.simIds.reduce((sum, esim) => sum + esim.topUps.length, 0);

        const { password, ...safeUser } = user;

        return res.status(200).json({
            message: "User details fetched successfully",
            user: {
                ...safeUser,
                stats: {
                    totalEsims,
                    totalPlans,
                    totalTopUps,
                },
            },
        });
    } catch (err: any) {
        console.error("Error fetching user details:", err);
        return res.status(500).json({ message: "Internal server error" });
    }
};

// ----------------- FILTER USERS (COUNTRY + PLAN) -----------------
export const getFilteredUsers = async (req: Request, res: Response) => {
    try {
        const isAdmin = await checkAdmin(req, res);
        if (!isAdmin) {
            return res.status(403).json({ message: "Unauthorized - Admins only" });
        }

        const { countryId, planId } = req.query;
        const ds = await getDataSource();
        const userRepo = ds.getRepository(User);

        let query = userRepo
            .createQueryBuilder("user")
            .leftJoinAndSelect("user.simIds", "esim")
            .leftJoinAndSelect("esim.country", "country")
            .leftJoinAndSelect("esim.plans", "plan")
            .where("user.isDeleted = :isDeleted", { isDeleted: false });

        if (countryId) {
            query = query.andWhere("country.id = :countryId", { countryId });
        }
        if (planId) {
            query = query.andWhere("plan.id = :planId", { planId });
        }

        const users = await query.getMany();

        // remove password
        const safeUsers = users.map((u) => {
            const { password, ...rest } = u;
            return rest;
        });

        return res.status(200).json({
            status: "success",
            message: "Users fetched successfully",
            data: safeUsers,
        });
    } catch (err) {
        console.error("❌ Error in getFilteredUsers:", err);
        return res.status(500).json({ status: "error", message: "Internal Server Error" });
    }
};

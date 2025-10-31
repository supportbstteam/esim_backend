import { Request, Response } from "express";
import { User } from "../../entity/User.entity";
import { getDataSource } from "../../lib/serverless";
import { checkAdmin } from "../../utils/checkAdmin";
import bcrypt from "bcryptjs";
import { Cart } from "../../entity/Carts.entity";
import { CartItem } from "../../entity/CartItem.entity";
import { Transaction } from "../../entity/Transactions.entity";
import { sendAccountDeletedEmail, sendUserBlockedEmail } from "../../utils/email";
import { Esim } from "../../entity/Esim.entity";
import { EsimTopUp } from "../../entity/EsimTopUp.entity";

// ----------------- CREATE USER -----------------
export const postAdminCreateUser = async (req: Request, res: Response) => {
  const { firstName, lastName, email, password, role, isActive } = req.body;

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
      isBlocked: isActive,
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

export const deleteAdminUser = async (req: Request, res: Response) => {
  const { userId } = req.params;

  try {
    // Check admin privilege
    const isAdmin = await checkAdmin(req, res);
    if (!isAdmin) return;

    const dataSource = await getDataSource();
    const userRepo = dataSource.getRepository(User);
    const cartRepo = dataSource.getRepository(Cart);
    const cartItemRepo = dataSource.getRepository(CartItem);
    const transactionRepo = dataSource.getRepository(Transaction);

    const user = await userRepo.findOne({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Start a transaction
    await dataSource.transaction(async (manager) => {
      // 1️⃣ Find all carts that can be safely deleted (not checked out + no transactions)
      const cartsToDelete = await manager
        .createQueryBuilder(Cart, "cart")
        .leftJoin(Transaction, "t", "t.cartId = cart.id")
        .where("cart.userId = :userId", { userId })
        .andWhere("cart.isCheckedOut = false")
        .andWhere("t.id IS NULL") // skip carts linked to transactions
        .getMany();

      if (cartsToDelete.length > 0) {
        const cartIds = cartsToDelete.map((c) => c.id);

        // 2️⃣ Delete all related cart items first
        await manager
          .createQueryBuilder()
          .delete()
          .from(CartItem)
          .where("cartId IN (:...cartIds)", { cartIds })
          .execute();

        // 3️⃣ Delete the carts themselves
        await manager
          .createQueryBuilder()
          .delete()
          .from(Cart)
          .where("id IN (:...cartIds)", { cartIds })
          .execute();
      }

      // await sendAccountDeletedEmail(user.email, user.firstName);

      // 4️⃣ Finally delete the user (only the user, not related data)
      await manager.delete(User, { id: userId });
    });

    return res
      .status(200)
      .json({ message: "User deleted successfully, orphan carts and their items cleaned up." });

  } catch (err: any) {
    console.error("Error hard deleting user:", err);
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

    await sendUserBlockedEmail(user.email, user.firstName, "");

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

    // 🧩 Build query with all nested joins
    let query = userRepo
      .createQueryBuilder("user")
      .leftJoinAndSelect("user.simIds", "esim")
      .leftJoinAndSelect("esim.country", "country")
      .leftJoinAndSelect("esim.plans", "plan")
      .leftJoinAndSelect("esim.topupLinks", "topupLinks")
      .leftJoinAndSelect("topupLinks.topup", "topupPlan")
      .orderBy("user.createdAt", "DESC");

    // 🧠 Optional filters
    if (countryId) {
      query = query.andWhere("country.id = :countryId", { countryId });
    }

    if (planId) {
      query = query.andWhere("plan.id = :planId", { planId });
    }

    // 🧾 Fetch users
    const users = await query.getMany();

    // 🛡️ Clean sensitive info & build consistent nested structure
    const safeUsers = users.map((user) => {
      const { password, ...safeUser } = user;

      return {
        ...safeUser,
        simIds: (user.simIds || []).map((esim) => ({
          ...esim,
          country: esim.country || null,
          plans: esim.plans || [],
          topUps:
            (esim.topupLinks || []).map((link) => {
              const t = link.topup;
              if (!t) return null;
              return {
                id: t.id,
                name: (t.name || t.title || "Unknown Plan").replace(/-/g, ""),
                title: (t.title || t.name || "Unknown Plan").replace(/-/g, ""),
                price: t.price || 0,
                validityDays: t.validityDays || null,
                dataLimit: t.dataLimit || null,
                currency: t.currency || "USD",
              };
            }).filter(Boolean) || [],
        })),
      };
    });

    return res.status(200).json({
      message: "Users fetched successfully",
      filters: { countryId, planId },
      users: safeUsers,
    });
  } catch (err: any) {
    console.error("Error fetching users:", err);
    return res.status(500).json({
      message: "Internal server error",
    });
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
    const esimRepo = dataSource.getRepository(Esim);
    const esimTopUpRepo = dataSource.getRepository(EsimTopUp);

    // ✅ Fetch user with all eSIMs, their country & plans
    const user = await userRepo.findOne({
      where: { id: userId },
      relations: ["simIds", "simIds.country", "simIds.plans"],
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // ✅ Fetch all top-ups related to user's eSIMs (via EsimTopUp)
    const userEsimIds = user.simIds.map((e) => e.id);
    let esimTopUps: EsimTopUp[] = [];

    if (userEsimIds.length > 0) {
      esimTopUps = await esimTopUpRepo
        .createQueryBuilder("et")
        .leftJoinAndSelect("et.esim", "esim")
        .leftJoinAndSelect("et.topup", "topup")
        .leftJoinAndSelect("et.order", "order")
        .where("et.esimId IN (:...ids)", { ids: userEsimIds })
        .getMany();
    }

    // ✅ Aggregate stats
    const totalEsims = user.simIds.length;
    const totalPlans = user.simIds.reduce(
      (sum, esim) => sum + (esim.plans?.length || 0),
      0
    );
    const totalTopUps = esimTopUps.length;

    // ✅ Attach top-ups grouped by eSIM
    const esimWithTopUps = user.simIds.map((esim) => {
      const relatedTopUps = esimTopUps.filter(
        (et: any) => et?.esim?.id === esim?.id
      );
      return {
        ...esim,
        topUps: relatedTopUps.map((et) => et.topup),
      };
    });

    // ✅ Exclude sensitive fields
    const { password, ...safeUser } = user;

    return res.status(200).json({
      message: "User details fetched successfully",
      user: {
        ...safeUser,
        simIds: esimWithTopUps,
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

export const putAdminUpdateUser = async (req: Request, res: Response) => {
  const { userId } = req.params;
  const { firstName, lastName, email, password, isActive } = req.body;

  try {
    const isAdmin = await checkAdmin(req, res);
    if (!isAdmin) return;

    const dataSource = await getDataSource();
    const userRepo = dataSource.getRepository(User);

    const user = await userRepo.findOne({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check if email is being updated and is already taken
    if (email && email !== user.email) {
      const existingUser = await userRepo.findOne({ where: { email } });
      if (existingUser) {
        return res.status(400).json({ message: "Email is already in use" });
      }
    }

    // Update fields if provided
    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    if (email) user.email = email;
    // must not be empty
    user.isBlocked = isActive;
    // if (role) user.role = role;
    if (password) {
      user.password = await bcrypt.hash(password, 10);
    }

    await userRepo.save(user);

    // exclude password in response
    const { password: _, ...safeUser } = user;

    return res.status(200).json({
      message: "User updated successfully",
      user: safeUser,
    });
  } catch (err: any) {
    console.error("Error updating user by admin:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};
import { Admin } from "../../entity/Admin.entity";
import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { generateToken } from "../../utils/generateToken";
import { getDataSource } from "../../lib/serverless"; // singleton DataSource

export const loginAdmin = async (req: Request, res: Response) => {
  const { username, password }: any = req.body;

  try {
    // Use singleton DataSource
    const dataSource = await getDataSource();
    const adminRepo = dataSource.getRepository(Admin);

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
    const dataSource = await getDataSource();
    const adminRepo = dataSource.getRepository(Admin);

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
    const dataSource = await getDataSource();
    const adminRepo = dataSource.getRepository(Admin);

    const admin = await adminRepo.findOne({ where: { id: req.user.id } });
    if (!admin) return res.status(404).json({ message: "Admin not found" });

    res.status(200).json({
      id: admin.id,
      name: admin.name,
      username: admin.username,
      notificationMail: admin?.notificationMail,
      status: 200,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error", error });
  }
};

export const adminAuthChangePassword = async (req: any, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const adminId = req.user.id;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "Current and new passwords are required" });
    }

    const dataSource = await getDataSource();
    const adminRepo = dataSource.getRepository(Admin);

    const admin = await adminRepo.findOne({ where: { id: adminId } });
    if (!admin) return res.status(404).json({ message: "Admin not found" });

    // Check if current password matches
    const isMatch = await bcrypt.compare(currentPassword, admin.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Current password is incorrect" });
    }

    // Hash the new password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    // Update password
    admin.password = hashedPassword;
    await adminRepo.save(admin);

    res.status(200).json({ message: "Password changed successfully" });
  } catch (error) {
    console.error("Error changing admin password:", error);
    res.status(500).json({ message: "Server error", error });
  }
};

export const adminChangeNotificationMail = async (req: any, res: Response) => {
  try {
    const { notificationMail } = req.body;
    const adminId = req.user.id;

    // Validation
    if (!notificationMail) {
      return res.status(400).json({ message: "Notification mail is required" });
    }

    // Basic email validation (optional but good to include)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(notificationMail)) {
      return res.status(400).json({ message: "Invalid email format" });
    }

    const dataSource = await getDataSource();
    const adminRepo = dataSource.getRepository(Admin);

    const admin = await adminRepo.findOne({ where: { id: adminId } });
    if (!admin) {
      return res.status(404).json({ message: "Admin not found" });
    }

    // Update notification mail
    admin.notificationMail = notificationMail;
    await adminRepo.save(admin);

    return res.status(200).json({
      message: "Notification mail updated successfully",
      notificationMail: admin.notificationMail,
    });
  } catch (error) {
    console.error("Error updating notification mail:", error);
    return res.status(500).json({
      message: "Server error while updating notification mail",
      error,
    });
  }
};

export const updateAdminProfile = async (req: any, res: Response) => {
  try {
    const adminId = req.user.id; // assuming it's coming from the token middleware
    const { name, notificationMail, email } = req.body;

    const dataSource = await getDataSource();
    const adminRepo = dataSource.getRepository(Admin);

    const admin = await adminRepo.findOne({ where: { id: adminId } });
    if (!admin) {
      return res.status(404).json({ message: "Admin not found" });
    }

    // Update fields (only if provided)
    if (name) admin.name = name;
    if (email) admin.username = email;
    if (notificationMail !== undefined) admin.notificationMail = notificationMail;

    await adminRepo.save(admin);

    res.status(200).json({
      message: "Profile updated successfully",
      admin: {
        id: admin.id,
        name: admin.name,
        email: admin.username,
        notificationMail: admin.notificationMail,
      },
    });
  } catch (error) {
    console.error("Error updating admin profile:", error);
    res.status(500).json({ message: "Server error", error });
  }
};
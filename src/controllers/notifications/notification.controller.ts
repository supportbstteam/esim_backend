// src/controllers/notification.controller.ts
import { Request, Response } from "express";
import { AppDataSource } from "../../data-source";
import { User } from "../../entity/User.entity";
import { pushToDevices } from "../../service/oneSignal.service";
import { Notification } from "../../entity/Notification.entity";

export const notifyUser = async (req: Request, res: Response) => {
  const { userId, title, message } = req.body;

  const repo = AppDataSource.getRepository(User);
  const user = await repo.findOneBy({ id: userId });

  if (!user?.oneSignalPlayerId) {
    return res.status(400).json({ message: "User device not registered" });
  }

  const result = await pushToDevices({
    playerIds: [user.oneSignalPlayerId],
    title,
    body: message,
    data: { userId },
  });

  res.json({ success: true, result: result.data });
};

export const getUserNotification = async (req: any, res: any) => {
  const { id } = req.user;

  if (!id) {
    return res.status(401).json({
      success: false,
      message: "User unauthorized",
    });
  }

  try {
    const userRepo = AppDataSource.getRepository(User);
    const notificationRepo = AppDataSource.getRepository(Notification);

    // ✅ validate user
    const user = await userRepo.findOne({
      where: {
        id,
        isBlocked: false,
        isDeleted: false,
        isVerified: true,
      },
    });

    if (!user) {
      return res.status(403).json({
        success: false,
        message: "User forbidden",
      });
    }

    // ✅ pagination params
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(
      50,
      Math.max(1, parseInt(req.query.limit as string) || 20)
    );

    const skip = (page - 1) * limit;

    // ✅ fetch notifications
    const [notifications, total] =
      await notificationRepo.findAndCount({
        where: { userId: id },
        order: { createdAt: "DESC" },
        skip,
        take: limit,
      });

    return res.status(200).json({
      success: true,
      data: notifications,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });

  } catch (err: any) {
    console.error("❌ getUserNotification error:", err);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch notifications",
    });
  }
};


export const putUserNotification = async (req: any, res: any) => {
  const { id } = req.user;
  const { notificationId } = req.body;

  if (!id) {
    return res.status(401).json({
      success: false,
      message: "User unauthorized",
    });
  }

  if (!notificationId)
    return res.status(404).json({
      message: "Bhadwe koyi notification nahi hai esa"
    })
  try {

  }
  catch (err) {

    console.error("❌ putUserNotification error:", err);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch notifications",
    });

  }
}
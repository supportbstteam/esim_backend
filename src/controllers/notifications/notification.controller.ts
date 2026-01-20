// src/controllers/notification.controller.ts
import { Request, Response } from "express";
import { AppDataSource } from "../../data-source";
import { User } from "../../entity/User.entity";
import { pushToDevices } from "../../service/oneSignal.service";
import { Notification } from "../../entity/Notification.entity";

export const notifyUser = async (req:any, res: Response) => {
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

export const getUserNotification = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    // Pagination
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    const notificationRepo = AppDataSource.getRepository(Notification);

    const [notifications, total] =
      await notificationRepo.findAndCount({
        where: { userId },
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

  } catch (error) {
    console.error("❌ getUserNotification error:", error);

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
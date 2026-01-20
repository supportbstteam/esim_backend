import { Request, Response } from "express";
import { AppDataSource } from "../../data-source";
import { NotificationContent } from "../../entity/NotificationContent.entity";

const repo = AppDataSource.getRepository(NotificationContent);

/**
 * Create notification template (used for Firebase push)
 */
export const createNotificationContent = async (
  req: Request,
  res: Response
) => {
  try {
    const { title, message, type, actionUrl, code } = req.body;

    // 🔒 Basic validation
    if (!title || !message || !type || !code) {
      return res.status(400).json({
        message: "title, message, type and code are required",
      });
    }

    // 🔁 Prevent duplicate templates
    const existing = await repo.findOne({ where: { code } });
    if (existing) {
      return res.status(409).json({
        message: "Notification content with this code already exists",
      });
    }

    const content = repo.create({
      title,
      message,
      type,        // e.g. PUSH, SYSTEM, ALERT
      actionUrl,   // optional deep link
      code,        // unique identifier
    });

    await repo.save(content);

    return res.status(201).json({
      message: "Notification content created",
      data: content,
    });

  } catch (err) {
    console.error("Create notification content error:", err);
    return res.status(500).json({
      message: "Failed to create notification content",
    });
  }
};

/**
 * List all notification templates
 */
export const listNotificationContents = async (
  req: Request,
  res: Response
) => {
  const contents = await repo.find({
    order: { createdAt: "DESC" },
  });

  return res.json(contents);
};

/**
 * Delete notification template
 */
export const deleteNotificationContent = async (
  req: Request,
  res: Response
) => {
  const { id } = req.params;

  const result = await repo.delete(id);

  if (!result.affected) {
    return res.status(404).json({
      message: "Notification content not found",
    });
  }

  return res.json({
    message: "Notification content deleted",
  });
};

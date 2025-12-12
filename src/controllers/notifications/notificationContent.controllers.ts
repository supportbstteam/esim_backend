import { Request, Response } from "express";
import { AppDataSource } from "../../data-source";
import { NotificationContent } from "../../entity/NotificationContent.entity";

const repo = AppDataSource.getRepository(NotificationContent);

export const createNotificationContent = async (
  req: Request,
  res: Response
) => {
  try {
    const { title, message, type, actionUrl, code } = req.body;

    const content = repo.create({
      title,
      message,
      type,
      actionUrl,
      code
    });

    await repo.save(content);
    return res.status(201).json(content);

  } catch (err) {
    return res.status(500).json({ message: "Failed to create notification content" });
  }
};

export const listNotificationContents = async (
  req: Request,
  res: Response
) => {
  const contents = await repo.find({
    order: { createdAt: "DESC" },
  });

  return res.json(contents);
};

export const deleteNotificationContent = async (
  req: Request,
  res: Response
) => {
  const { id } = req.params;
  await repo.delete(id);

  return res.json({ message: "Notification content deleted" });
};

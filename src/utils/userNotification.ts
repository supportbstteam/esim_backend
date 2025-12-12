import axios from "axios";
import { AppDataSource } from "../data-source";
import { NotificationContent } from "../entity/NotificationContent.entity";
import { UserDevice } from "../entity/UserDevices.entity";
import { Notification } from "../entity/Notification.entity";

export const sendUserNotification = async ({
  userId,
  code,
  data = {},
}: {
  userId: string;
  code: string;
  data?: any;
}) => {
  const contentRepo = AppDataSource.getRepository(NotificationContent);
  const deviceRepo = AppDataSource.getRepository(UserDevice);
  const notificationRepo = AppDataSource.getRepository(Notification);

  // 1️⃣ Load template
  const content = await contentRepo.findOne({
    where: { code, isActive: true },
  });

  if (!content) {
    throw new Error(`Notification template missing: ${code}`);
  }

  // 2️⃣ Load devices
  const devices = await deviceRepo.find({ where: { userId } });

  if (!devices.length) {
    throw new Error("No devices found for user");
  }

  const playerIds = devices.map(d => d.playerId);

  // 3️⃣ Save notification in DB (before sending)
  const notification = notificationRepo.create({
    userId,
    contentId: content.id,
    meta: data,
    isRead: false,
    isSent: false,
  });

  await notificationRepo.save(notification);

  // 4️⃣ Send to OneSignal
  try {
    const response = await axios.post(
      "https://onesignal.com/api/v1/notifications",
      {
        app_id: process.env.ONESIGNAL_APP_ID,
        include_player_ids: playerIds,
        headings: { en: content.title },
        contents: { en: content.message },
        data,
      },
      {
        headers: {
          Authorization: `Basic ${process.env.ONE_SIGNAL_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    // 5️⃣ Mark as sent
    notification.isSent = true;
    await notificationRepo.save(notification);

    return response.data;

  } catch (err: any) {
    console.error("💥 OneSignal failed");

    if (err.response) {
      console.error("OneSignal Error:", err.response.data);
    }

    // ❗ DB record stays with isSent=false (retry-friendly)
    throw err;
  }
};

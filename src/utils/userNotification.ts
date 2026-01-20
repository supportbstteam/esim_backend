import admin from "../firebase";
import { AppDataSource } from "../data-source";
import { NotificationContent } from "../entity/NotificationContent.entity";
import { UserDevice } from "../entity/UserDevices.entity";
import { Notification, NotificationStatus } from "../entity/Notification.entity";

export const sendUserNotification = async ({
  userId,
  code,
  data = {},
}: {
  userId: string;
  code: string;
  data?: Record<string, any>;
}) => {
  const contentRepo = AppDataSource.getRepository(NotificationContent);
  const deviceRepo = AppDataSource.getRepository(UserDevice);
  const notificationRepo = AppDataSource.getRepository(Notification);

  // 1️⃣ Load notification template
  const content = await contentRepo.findOne({
    where: { code, isActive: true },
  });

  if (!content) {
    throw new Error(`Notification template missing: ${code}`);
  }

  // 2️⃣ Load user devices (FCM tokens)
  const devices = await deviceRepo.find({
    where: { userId },
  });

  // 3️⃣ Always create notification record (DB = source of truth)
  const notification = notificationRepo.create({
    userId,
    contentId: content.id,
    meta: data,
    status: NotificationStatus.PENDING,
    isRead: false,
  });

  await notificationRepo.save(notification);

  // 🚫 No devices → skip push but keep DB record
  if (!devices.length) {
    notification.status = NotificationStatus.FAILED;
    notification.error = "No registered devices";
    await notificationRepo.save(notification);

    return {
      success: true,
      skipped: true,
      reason: "No devices found",
    };
  }

  const tokens = devices.map(d => d.token);

  // 4️⃣ Send Firebase push
  try {
    const response = await admin.messaging().sendEachForMulticast({
      tokens,
      notification: {
        title: content.title,
        body: content.message ?? "",
      },
      data: {
        code: content.code,
        ...(data || {}),
        actionUrl: content.actionUrl ?? "",
      },
    });

    const hasFailure = response.responses.some(r => !r.success);

    if (hasFailure) {
      notification.status = NotificationStatus.FAILED;
      notification.error = "One or more FCM tokens failed";
    } else {
      notification.status = NotificationStatus.SENT;
      notification.sentAt = new Date();
    }

    await notificationRepo.save(notification);

    return {
      success: true,
      skipped: false,
      firebase: {
        successCount: response.successCount,
        failureCount: response.failureCount,
      },
    };

  } catch (err: any) {
    console.error("💥 Firebase push failed:", err.message);

    notification.status = NotificationStatus.FAILED;
    notification.error = err.message;
    await notificationRepo.save(notification);

    throw err;
  }
};

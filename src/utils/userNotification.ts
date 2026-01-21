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
  console.log("🚀 sendUserNotification START", { userId, code });

  const contentRepo = AppDataSource.getRepository(NotificationContent);
  const deviceRepo = AppDataSource.getRepository(UserDevice);
  const notificationRepo = AppDataSource.getRepository(Notification);

  /**
   * 0️⃣ Hard validation
   */
  if (!userId) {
    console.error("❌ sendUserNotification: userId missing");
    return { success: false, reason: "userId missing" };
  }

  if (!code) {
    console.error("❌ sendUserNotification: code missing");
    return { success: false, reason: "code missing" };
  }

  /**
   * 1️⃣ Load notification content (MANDATORY)
   */
  const content = await contentRepo.findOne({
    where: { code, isActive: true },
  });

  if (!content) {
    console.error("❌ NotificationContent not found or inactive", { code });

    // 🚫 Do NOT create Notification without contentId
    return {
      success: false,
      reason: `Notification template not found: ${code}`,
    };
  }

  /**
   * 2️⃣ Load user devices
   */
  const devices = await deviceRepo.find({
    where: { userId },
  });

  console.log(`📱 Devices found for user ${userId}:`, devices.length);

  /**
   * 3️⃣ Create notification record (DB = SOURCE OF TRUTH)
   */
  const notification = notificationRepo.create({
    userId,
    contentId: content.id,
    meta: data,
    status: NotificationStatus.PENDING,
    isRead: false,
  });

  await notificationRepo.save(notification);

  /**
   * 4️⃣ No devices → mark failed & exit
   */
  if (devices.length === 0) {
    console.warn("⚠️ No devices found, skipping push");

    notification.status = NotificationStatus.FAILED;
    notification.error = "No registered devices";
    await notificationRepo.save(notification);

    return {
      success: true,
      skipped: true,
      reason: "No registered devices",
    };
  }

  const tokens = devices.map(d => d.token);

  /**
   * 5️⃣ Send Firebase push
   */
  try {
    console.log("📤 Sending Firebase push", {
      tokens: tokens.length,
      code: content.code,
    });

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

    console.log("📬 Firebase response", {
      successCount: response.successCount,
      failureCount: response.failureCount,
    });

    /**
     * 6️⃣ Clean invalid tokens
     */
    await Promise.all(
      response.responses.map(async (r, index) => {
        if (!r.success) {
          const errorCode = r.error?.code;

          console.error("❌ Token failed", {
            token: tokens[index],
            errorCode,
          });

          if (
            errorCode === "messaging/registration-token-not-registered" ||
            errorCode === "messaging/invalid-registration-token"
          ) {
            await deviceRepo.delete({ token: tokens[index] });
            console.log("🧹 Deleted invalid FCM token");
          }
        }
      })
    );

    /**
     * 7️⃣ Update notification status
     */
    if (response.failureCount > 0) {
      notification.status = NotificationStatus.FAILED;
      notification.error = "One or more devices failed";
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
    console.error("💥 Firebase send error", err);

    notification.status = NotificationStatus.FAILED;
    notification.error = err.message || "Firebase send failed";
    await notificationRepo.save(notification);

    return {
      success: false,
      reason: "Firebase error",
      error: err.message,
    };
  }
};

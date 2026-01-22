import admin from "../firebase";
import { AppDataSource } from "../data-source";
import { NotificationContent } from "../entity/NotificationContent.entity";
import { UserDevice } from "../entity/UserDevices.entity";
import { Notification, NotificationStatus } from "../entity/Notification.entity";

/**
 * Resolve {{placeholders}} using data
 */
const resolveTemplate = (
  template: string,
  data: Record<string, any>
): string => {
  return template.replace(/{{\s*(\w+)\s*}}/g, (_, key) => {
    return data[key] !== undefined ? String(data[key]) : "";
  });
};

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
   * 0️⃣ Validation
   */
  if (!userId || !code) {
    return { success: false, reason: "userId or code missing" };
  }

  /**
   * 1️⃣ Load template
   */
  const content = await contentRepo.findOne({
    where: { code, isActive: true },
  });

  if (!content) {
    console.error("❌ Notification template not found", { code });
    return { success: false, reason: "Template not found" };
  }

  /**
   * 2️⃣ Create DB notification (SOURCE OF TRUTH)
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
   * 3️⃣ Load user devices
   */
  const devices = await deviceRepo.find({ where: { userId } });

  if (devices.length === 0) {
    notification.status = NotificationStatus.FAILED;
    notification.error = "No registered devices";
    await notificationRepo.save(notification);

    return { success: true, skipped: true };
  }

  const tokens = devices.map(d => d.token);

  /**
   * 4️⃣ Resolve templates for PUSH ONLY
   */
  const title = resolveTemplate(content.title, data);
  const body = resolveTemplate(content.message ?? "", data);

  /**
   * ⚠️ Warn if unresolved placeholders remain
   */
  const unresolved = body.match(/{{\s*\w+\s*}}/g);
  if (unresolved?.length) {
    console.warn("⚠️ Unresolved placeholders", {
      code,
      unresolved,
      data,
    });
  }

  /**
   * 5️⃣ Send Firebase push
   */
  try {
    const response = await admin.messaging().sendEachForMulticast({
      tokens,
      notification: {
        title,
        body,
      },
      data: {
        code: content.code,
        ...(data || {}),
        actionUrl: content.actionUrl ?? "",
      },
    });

    /**
     * 6️⃣ Cleanup invalid tokens
     */
    await Promise.all(
      response.responses.map(async (r, index) => {
        if (!r.success) {
          const errorCode = r.error?.code;
          if (
            errorCode === "messaging/invalid-registration-token" ||
            errorCode === "messaging/registration-token-not-registered"
          ) {
            await deviceRepo.delete({ token: tokens[index] });
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
      firebase: {
        successCount: response.successCount,
        failureCount: response.failureCount,
      },
    };
  } catch (err: any) {
    notification.status = NotificationStatus.FAILED;
    notification.error = err.message || "Firebase send failed";
    await notificationRepo.save(notification);

    return { success: false, error: err.message };
  }
};

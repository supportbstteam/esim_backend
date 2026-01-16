import { Request, Response } from "express";
import { AppDataSource } from "../../data-source";
import { UserDevice } from "../../entity/UserDevices.entity";
import { sendUserNotification } from "../../utils/userNotification";

export const testNotificationController = async (req:any, res: Response) => {
  try {
    // ✅ SAFELY access body
    const userId = req.body?.userId;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "userId is required",
      });
    }

    const deviceRepo = AppDataSource.getRepository(UserDevice);

    // ✅ Check if user has registered device
    const devices = await deviceRepo.find({ where: { userId } });

    if (!devices.length) {
      return res.status(404).json({
        success: false,
        message: "No registered devices found for this user",
      });
    }

    // ✅ Trigger test push
    await sendUserNotification({
      userId,
      code: "TEST_NOTIFICATION",
      data: {
        message: "Backend test notification",
        timestamp: new Date().toISOString(),
      },
    });

    return res.json({
      success: true,
      message: "✅ Test notification sent. Check your device.",
      devices: devices.map(d => ({
        playerId: d.playerId,
        platform: d.platform,
      })),
    });

  } catch (error: any) {
    console.error("❌ Notification test failed:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to send test notification",
      error: error.message,
    });
  }
};

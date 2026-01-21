import { Request, Response } from "express";
import { Not } from "typeorm";
import { AppDataSource } from "../../data-source";
import { UserDevice } from "../../entity/UserDevices.entity";

export const registerPushToken = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const { token, platform } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    if (!token || !platform) {
      return res.status(400).json({
        success: false,
        message: "token and platform are required",
      });
    }

    if (!["android", "ios"].includes(platform)) {
      return res.status(400).json({
        success: false,
        message: "Invalid platform",
      });
    }

    const deviceRepo = AppDataSource.getRepository(UserDevice);

    /**
     * Remove OLD tokens only for THIS USER + PLATFORM
     */
    await deviceRepo.delete({
      userId,
      platform,
      token: Not(token),
    });

    /**
     * Upsert CURRENT token
     */
    await deviceRepo.upsert(
      {
        userId,
        token,
        platform,
      },
      ["token"]
    );

    return res.status(200).json({
      success: true,
      message: "FCM device registered successfully",
    });

  } catch (error: any) {
    console.error("❌ registerPushToken error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to register device",
    });
  }
};

export const removePushToken = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const { token, platform } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    if (!token || !platform) {
      return res.status(400).json({
        success: false,
        message: "token and platform are required",
      });
    }

    if (!["android", "ios"].includes(platform)) {
      return res.status(400).json({
        success: false,
        message: "Invalid platform",
      });
    }

    const deviceRepo = AppDataSource.getRepository(UserDevice);

    const result = await deviceRepo.delete({
      userId,
      token,
      platform,
    });

    if (result.affected === 0) {
      return res.status(200).json({
        success: true,
        message: "Device already removed or not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "FCM device removed successfully",
    });

  } catch (error: any) {
    console.error("❌ removePushToken error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to remove device",
    });
  }
};
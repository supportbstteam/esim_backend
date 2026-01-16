// src/controllers/device.controller.ts
import { Request, Response } from "express";
import { Not } from "typeorm";
import { AppDataSource } from "../../data-source";
import { UserDevice } from "../../entity/UserDevices.entity";

export const registerPlayerId = async (req:any, res: Response) => {
  try {
    /**
     * userId should come from auth middleware (JWT)
     * NOT from request body (security risk)
     */
    const userId = (req as any).user?.id;
    const { playerId, platform } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    if (!playerId || !platform) {
      return res.status(400).json({
        success: false,
        message: "playerId and platform are required",
      });
    }

    const deviceRepo = AppDataSource.getRepository(UserDevice);

    /**
     * ✅ STEP 1: Remove OLD playerIds
     * Handles:
     * - app reinstall
     * - duplicate devices
     * - stale tokens
     */
    await deviceRepo.delete({
      userId,
      platform,
      playerId: Not(playerId),
    });

    /**
     * ✅ STEP 2: Upsert CURRENT playerId
     * - Same install → no duplicate
     * - New install → replaces old
     */
    await deviceRepo.upsert(
      {
        userId,
        playerId,
        platform,
      },
      ["playerId"]
    );

    return res.json({
      success: true,
      message: "✅ Device registered successfully",
    });

  } catch (error: any) {
    console.error("❌ registerPlayerId error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to register device",
    });
  }
};

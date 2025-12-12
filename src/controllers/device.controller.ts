// src/controllers/device.controller.ts
import { Request, Response } from "express";
import { AppDataSource } from "../data-source";
import { User } from "../entity/User.entity";

// d246268c-4f38-47fa-ba7b-1e6aa3e31132

export const registerDevice = async (req: Request, res: Response) => {
  const { userId, playerId } = req.body;

  if (!playerId) {
    return res.status(400).json({ message: "Player ID required" });
  }

  const repo = AppDataSource.getRepository(User);

  await repo.update(
    { id: userId },
    { oneSignalPlayerId: playerId }
  );

  return res.json({ success: true });
};
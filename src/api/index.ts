// src/api/index.ts
import "reflect-metadata";
import "dotenv/config";
import app from "../app";
import { AppDataSource } from "../data-source";

export default async function handler(req: any, res: any) {
  try {
    if (!AppDataSource.isInitialized) {
      console.log("🔄 Initializing DB (vercel)...");
      await AppDataSource.initialize();
      console.log("✅ DB initialized (vercel)");
    }

    return app(req, res);
  } catch (error) {
    console.error("❌ DB init error (vercel):", error);
    res.status(500).json({
      success: false,
      message: "Database initialization failed",
    });
  }
}

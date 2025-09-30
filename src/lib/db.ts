// src/lib/db.ts
import { AppDataSource } from "../data-source";

export const connectDB = async () => {
  try {
    // Initialize TypeORM
    await AppDataSource.initialize();

    console.log("✅ MySQL connected successfully with TypeORM");

    // 👀 Debug: list loaded entities to confirm User is included
    const loadedEntities = AppDataSource.entityMetadatas.map(e => e.name);
    console.log("📦 Loaded entities:", loadedEntities);

    if (!loadedEntities.includes("User")) {
      console.warn("⚠️ User entity not loaded! Signup/login will fail.");
    }

  } catch (err) {
    console.error("❌ MySQL connection failed:", err);
    process.exit(1);
  }
};

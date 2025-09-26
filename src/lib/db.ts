import { AppDataSource } from "../data-source";

export const connectDB = async () => {
  try {
    await AppDataSource.initialize();
    console.log("✅ MySQL connected successfully with TypeORM");
  } catch (err) {
    console.error("❌ MySQL connection failed:", err);
    process.exit(1);
  }
};
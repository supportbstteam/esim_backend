import "reflect-metadata";
import "dotenv/config";
import app from "./app";
import { AppDataSource } from "./data-source";

const PORT = process.env.PORT || 4000;

(async () => {
  try {
    await AppDataSource.initialize();
    console.log("📦 Data Source initialized");
    console.log("📦 Loaded entities:", AppDataSource.entityMetadatas.map(e => e.name));

    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("❌ Database connection failed:", error);
    process.exit(1);
  }
})();

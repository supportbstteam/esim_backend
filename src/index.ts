// src/index.ts
import "reflect-metadata";
import "dotenv/config";
import app from "./app";
import { AppDataSource } from "./data-source";

const PORT = Number(process.env.PORT) || 4000;

async function startServer() {
  try {
    if (!AppDataSource.isInitialized) {
      console.log("🔄 Initializing DB (local)...");
      await AppDataSource.initialize();
      console.log("✅ DB initialized (local)");
    }

    app.listen(PORT, () => {
      console.log(`🚀 Local server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("❌ Failed to start local server:", error);
    process.exit(1);
  }
}

startServer();

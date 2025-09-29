import "reflect-metadata"; // MUST be first
import "dotenv/config";
import app from "./app";
import { connectDB } from "./lib/db";

const PORT = process.env.PORT || 4000;

(async () => {
  await connectDB(); // TypeORM initialized before server

  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
  });
})();

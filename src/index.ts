import "reflect-metadata";
import "dotenv/config"; // optional for env
import app from "./app";
import { connectDB } from "./lib/db";

const PORT = process.env.PORT || 4000;

(async () => {
  await connectDB(); // connects TypeORM + MySQL

  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
  });
})();

import dotenv from "dotenv";
dotenv.config();

// import { connectDB } from "./config/db";
import app from "./app";
import { connectDB } from "./lib/db";

const PORT = process.env.PORT || 4000;
const MONGO_URI:string = process.env.MONGO_URI || "";

(async () => {
  await connectDB(MONGO_URI);

  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
  });
})();
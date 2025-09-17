import dotenv from "dotenv";
dotenv.config(); // load .env locally

import app from "./app";
import { connectDB } from "./lib/db";

const PORT = process.env.PORT || 5000;

// For local dev
if (process.env.NODE_ENV !== "production") {
  (async () => {
    await connectDB();
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  })();
}

// For Vercel serverless
export default app;

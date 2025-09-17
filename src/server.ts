import app from "./app";
import connectDB from "./config/db";

// Ensure MongoDB connection is ready for serverless
(async () => {
  await connectDB();
})();

// ❌ Do NOT call app.listen()
// Instead, just export the app (Vercel will handle requests)
export default app;

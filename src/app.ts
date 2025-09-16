import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import connectDB from "./config/db";
import { protect } from "./middlewares/authHandler";
import userRoute from "./routes/user";
import adminRoute from "./routes/admin";

dotenv.config();

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// Protect all routes after this
app.use(protect);

// ✅ Common route loader
function registerRoutes(app: express.Application, version?: string) {
  const basePath = "/api";
  // const basePath = version ? `/api/${version}` : "/api";

  app.use(`${basePath}/user`, userRoute);
  app.use(`${basePath}/admin`, adminRoute);

  // optional root endpoint for health check / info
  app.get(basePath, (req, res) => {
    res.send(
      version
        ? `eSIM API ${version.toUpperCase()} is running 🚀`
        : "eSIM API is running 🚀"
    );
  });
}

// Default `/api`
registerRoutes(app);

// Versioned `/api/v1`
registerRoutes(app, "v1");

// Root
app.get("/", (req, res) => {
  res.send("eSIM Management API Root 🌐");
});

export default app;

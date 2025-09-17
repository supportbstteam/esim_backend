import express from "express";
import cors from "cors";
import { protect } from "./middlewares/authHandler";
import userRoute from "./routes/user";
import adminRoute from "./routes/admin";

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// Protect all routes after this
app.use(protect);

// ✅ Register routes without versioning
const basePath = "/api";

app.use(`${basePath}/user`, userRoute);
app.use(`${basePath}/admin`, adminRoute);

// Root endpoint for health check/info
app.get(basePath, (req, res) => {
  res.send("eSIM API is running 🚀");
});

// Root
app.get("/", (req, res) => {
  res.send("eSIM Management API Root 🌐");
});

export default app;

import express from "express";
import morgan from "morgan";
import cors from "cors";
import helmet from "helmet";
import { errorHandler } from "./middlewares/error.handler";
import adminRouter from "./routes/admin/admin.route";
import userRouter from "./routes/user/user.route";
import { auth } from "./middlewares/auth.handler";
import { AppDataSource } from "./data-source";
import cron from "node-cron";
import { postSchedularImportPlans } from "./controllers/admin/adminSchedulerController";

const app = express();

// ======= Third-party middleware =======
app.use(morgan("dev"));
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ======= Routes =======
app.get("/", (req, res) => res.send("Hello from Node + TypeORM + MySQL!"));
app.get("/api", (req, res) =>
  res.send("Hello from Node + TypeORM + MySQL! with our Esim products")
);

app.get("/api/entities", (req, res) => {
  const entities = AppDataSource.entityMetadatas.map((e) => ({
    name: e.name,
    tableName: e.tableName,
    columns: e.columns.map((c) => c.propertyName),
  }));
  res.json({ message: "Loaded entities", count: entities.length, entities });
});

app.use("/api/admin", auth, adminRouter);
app.use("/api/user", userRouter);
app.use(errorHandler);

// ======= Initialize DB and then Start Everything =======
AppDataSource.initialize()
  .then(() => {
    console.log("✅ Database connected.");

    // 🕒 Start cron after DB is ready
    cron.schedule(
      "0 0 * * *", // ⏰ Every day at 00:00
      async () => {
        console.log("🕛 Running scheduler (Europe/Istanbul): Importing 3rd-party plans...");
        try {
          await postSchedularImportPlans();
          console.log("✅ Scheduler completed successfully");
        } catch (err) {
          console.error("❌ Scheduler failed:", err);
        }
      },
      {
        timezone: "Europe/Istanbul", // 👈 ensures midnight Turkey time
      }
    );

    // 🚀 Start the server
    app.listen(4000, "0.0.0.0", () => console.log("🚀 Server running on port 4000"));
  })
  .catch((err) => {
    console.error("❌ DB initialization failed:", err);
  });

export default app;

import express from "express";
import morgan from "morgan";
import cors from "cors";
import helmet from "helmet";
import bodyParser from "body-parser";
import { errorHandler } from "./middlewares/error.handler";
import adminRouter from "./routes/admin/admin.route";
import userRouter from "./routes/user/user.route";
import { auth } from "./middlewares/auth.handler";
import { AppDataSource } from "./data-source";
import cron from "node-cron";
import { postSchedularImportPlans } from "./controllers/admin/adminSchedulerController";

// webhooks
import { handleMobileStripeWebhook } from "./controllers/stripe/MobileCartStripe.controllers";
import { handleMobileTopUpStripeWebhook } from "./controllers/stripe/MobileTopUpStripe.controllers";
import { handleStripeWebhook } from "./controllers/stripe/CartStrip.controller";
import notificationContentRoute from "./routes/notifications/notificationContent.routes"
import { testNotificationController } from "./controllers/notifications/testNotification";
import { ALLOWED_PATH_ORIGINS } from "./utils/allowedCors";
const app = express();

// ======= Third-party middleware =======
app.use(morgan("dev"));
app.use(helmet());

app.use(
  cors({
    origin: (origin, callback) => {
      console.log("Incoming Origin:", origin);

      // Allow Postman, mobile apps, server-to-server (no origin)
      if (!origin) return callback(null, true);

      if (ALLOWED_PATH_ORIGINS.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// ⚠️ IMPORTANT: Register webhook BEFORE express.json() to keep raw body
app.post(
  "/api/user/transactions/stripe/webhook",
  bodyParser.raw({ type: "application/json" }),
  handleStripeWebhook
);

app.post(
  "/api/user/transactions/mobile/stripe/webhook",
  bodyParser.raw({ type: "application/json" }),
  handleMobileStripeWebhook
);

app.post(
  "/api/user/transactions/mobile/top-up/stripe/webhook",
  bodyParser.raw({ type: "*/*" }),
  handleMobileTopUpStripeWebhook
);

// ✅ Apply JSON/body parsers for all OTHER routes (after webhook)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ======= Routes =======
app.get("/", (req, res) => res.send("Hello from Node + TypeORM + MySQL!"));
app.get("/api", (req, res) =>
  res.send("Hello from Node + TypeORM + MySQL! with our Esim products")
);

app.post("/notifications/test", testNotificationController);

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
app.use("/api/notification-content", notificationContentRoute);

app.use(errorHandler);

// ======= Initialize DB and then Start Everything =======
// AppDataSource.initialize()
//   .then(() => {
//     // console.log("✅ Database connected.");

//     // 🕒 Start cron after DB is ready
//     cron.schedule(
//       "0 0 * * *", // ⏰ Every day at 00:00
//       async () => {
//         // console.log("🕛 Running scheduler (Europe/Istanbul): Importing 3rd-party plans...");
//         try {
//           await postSchedularImportPlans();
//           // console.log("✅ Scheduler completed successfully");
//         } catch (err) {
//           console.error("❌ Scheduler failed:", err);
//         }
//       },
//       {
//         timezone: "Europe/Istanbul", // 👈 ensures midnight Turkey time
//       }
//     );

//     // 🚀 Start the server
//     app.listen(4000, "0.0.0.0", () => // console.log("🚀 Server running on port 4000"));
//   })
//   .catch((err) => {
//     console.error("❌ DB initialization failed:", err);
//   });

export default app;


// stripe listen --forward-to localhost:4000/api/user/transactions/mobile/top-up/stripe/webhook
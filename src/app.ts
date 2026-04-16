import express from "express";
import morgan from "morgan";
import cors from "cors";
import helmet from "helmet";
import bodyParser from "body-parser";
import path from "path";
import os from "os";

import { errorHandler } from "./middlewares/error.handler";
import { auth } from "./middlewares/auth.handler";
import adminRouter from "./routes/admin/admin.route";
import userRouter from "./routes/user/user.route";
import notificationContentRoute from "./routes/notifications/notificationContent.routes";
// import { testNotificationController } from "./controllers/notifications/testNotification";
import { ALLOWED_PATH_ORIGINS } from "./utils/allowedCors";

// Stripe webhooks
import { handleMobileStripeWebhook } from "./controllers/stripe/MobileCartStripe.controllers";
import { handleMobileTopUpStripeWebhook } from "./controllers/stripe/MobileTopUpStripe.controllers";
import { handleStripeWebhook } from "./controllers/stripe/CartStrip.controller";
import { paypalWebhook } from "./controllers/paypal.webhook.controllers";
import { reserveSim } from "./lib/globalFunction";

const app = express();

/* =====================================================
   1️⃣ LOGGING & SECURITY
===================================================== */
app.use(morgan("dev"));

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

/* =====================================================
   2️⃣ CORS — MUST BE FIRST (VERY IMPORTANT)
===================================================== */
app.use(
  cors({
    origin: (origin, callback) => {
      console.log("Incoming Origin:", origin);

      // Allow server-to-server, mobile apps, Postman
      if (!origin) return callback(null, true);

      if (ALLOWED_PATH_ORIGINS.includes(origin)) {
        return callback(null, true);
      }

      // ❗ DO NOT throw error
      return callback(null, false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "Stripe-Signature",
      "Paypal-Transmission-Id",
      "Paypal-Transmission-Time",
      "Paypal-Cert-Url",
      "Paypal-Auth-Algo",
      "Paypal-Transmission-Sig"
    ],
  })
);



/* =====================================================
   3️⃣ PRE-FLIGHT HANDLER (CRITICAL FOR VERCEL)
===================================================== */
// app.options("*", cors());

/* =====================================================
   4️⃣ STRIPE WEBHOOKS (RAW BODY ONLY)
===================================================== */

app.post(
  "/api/user/transactions/stripe/webhook",
  bodyParser.raw({ type: "application/json" }),
  handleStripeWebhook
);

app.post("/api/paypal/webhook", bodyParser.raw({ type: "application/json" }), paypalWebhook);

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

/* =====================================================
   5️⃣ BODY PARSERS (AFTER WEBHOOKS)
===================================================== */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* =====================================================
   6️⃣ ROUTES
===================================================== */
app.get("/", (_req, res) => {
  // console.log("Hello world",_req.headers["user-agent"]);
  res.send("Hello from Node + TypeORM + MySQL!",);
});

app.get("/api", (_req, res) => {
  res.send("Hello from Node + TypeORM + MySQL! with our Esim products",);
});

// app.post("/notifications/test", testNotificationController);

/* =====================================================
   7️⃣ STATIC FILES UPLOADING
===================================================== */
// uncomment for the live server
// const uploadsDir = path.join(os.homedir(), "Desktop", "uploadsimg");
const uploadsDir = path.join(os.homedir(), "var", "www", "html", "esimaero.com", "uploadsimg");

// uncomment for the live server
app.use("/api/uploadsimg", express.static(uploadsDir));

/* =====================================================
   8️⃣ API ROUTES
===================================================== */
app.use("/api/admin", auth, adminRouter); // auth-protected
app.use("/api/user", userRouter);         // user routes
app.use("/api/notification-content", notificationContentRoute);

/* =====================================================
   9️⃣ ERROR HANDLER (LAST)
===================================================== */
app.use(errorHandler);

export default app;

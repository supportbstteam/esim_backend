import cron from "node-cron";
import { postSchedularImportPlans } from "../controllers/admin/adminSchedulerController";

export const startScheduler = () => {
  // ✅ TEST (har 5 min)
cron.schedule("*/5 * * * *", async () => {
    console.log("⏳ CRON STARTED...");

    await postSchedularImportPlans(); // 👈 DIRECT CALL

    console.log("✅ CRON FINISHED...");
  });
};
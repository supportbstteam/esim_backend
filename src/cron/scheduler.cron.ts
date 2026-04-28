import cron from "node-cron";
import { postSchedularImportPlans } from "../controllers/admin/adminSchedulerController";

export const startScheduler = () => {
  // ⏰ Roz 3 baje chalega
  cron.schedule("0 3 * * *", async () => {
    console.log("⏳ CRON STARTED...");

    await postSchedularImportPlans(); // 👈 DIRECT CALL

    console.log("✅ CRON FINISHED...");
  });
};
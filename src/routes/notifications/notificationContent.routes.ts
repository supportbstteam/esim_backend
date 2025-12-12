import { Router } from "express";
import { createNotificationContent, listNotificationContents, deleteNotificationContent } from "../../controllers/notifications/notificationContent.controllers";

const router = Router();

router.post("/create", createNotificationContent);
router.get("/", listNotificationContents);
router.delete("/:id", deleteNotificationContent);

export default router;

import express, { Response } from 'express'
import { getUserNotification } from '../../controllers/notifications/notification.controller';
import { auth } from '../../middlewares/auth.handler';

const router = express.Router();

router.get("/", getUserNotification);
router.put("/", getUserNotification);

export default router;
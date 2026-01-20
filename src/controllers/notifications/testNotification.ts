import { Request, Response } from "express";
import admin from "../../firebase";
import { AppDataSource } from "../../data-source";
import { UserDevice } from "../../entity/UserDevices.entity";

export const sendTestNotification = async (req: any, res: Response) => {
    try {

        // console.log("req?.user",req?.user);
        // return res.status(200);
        const { id: userId } = req?.user;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized",
            });
        }

        const deviceRepo = AppDataSource.getRepository(UserDevice);

        // 1️⃣ Fetch user's devices
        const devices = await deviceRepo.find({
            where: { userId },
        });

        if (!devices.length) {
            return res.status(404).json({
                success: false,
                message: "No registered devices for this user",
            });
        }

        const tokens = devices.map(d => d.token);

        // 2️⃣ Send Firebase push
        const response = await admin.messaging().sendEachForMulticast({
            tokens,
            notification: {
                title: "🧪 Test Notification",
                body: "Firebase push test from backend 🚀",
            },
            data: {
                type: "TEST",
                source: "MANUAL",
            },
        });

        return res.json({
            success: true,
            sentTo: tokens.length,
            successCount: response.successCount,
            failureCount: response.failureCount,
        });

    } catch (error: any) {
        console.error("❌ Test notification error:", error);

        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

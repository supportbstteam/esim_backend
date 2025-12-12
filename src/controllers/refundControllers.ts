import { Request, Response } from "express";
import { AppDataSource } from "../data-source";
import { Esim } from "../entity/Esim.entity";
import { Order } from "../entity/order.entity";
import { sendRefundClaimEmail } from "../utils/email";

/**
 * 💰 Controller: Claim Refund for an Order
 * @route POST /api/refund/claim
 */
export const claimRefund = async (req: any, res: Response) => {
    try {
        const user = req.user; // comes from auth middleware
        const { orderId, message } = req.body;

        if (!orderId) {
            return res.status(400).json({ message: "orderId is required" });
        }

        // ✅ Fetch order with relations
        const orderRepo = AppDataSource.getRepository(Order);
        const order = await orderRepo.findOne({
            where: { id: orderId },
            relations: ["esims", "user", "country"],
        });

        if (!order) {
            return res.status(404).json({ message: "Order not found" });
        }

        // 🧠 Validate user ownership (user can only claim their own order)
        if (order.user?.id !== user.id) {
            return res.status(403).json({ message: "You cannot claim refund for this order" });
        }

        // ✅ Determine refund scenario
        const failedEsims = order.esims.filter((e) => !e?.iccid && !e?.qrCodeUrl);
        const totalEsims = order.esims.length;

        if (failedEsims.length === 0) {
            return res.status(400).json({
                message: "No failed eSIMs found in this order. Refund claim not applicable.",
            });
        }

        // 🧾 Build refund payload for email
        const refundPayload = {
            order,
            user,
            claimReason: message || "No message provided",
            failedEsims,
            scenario:
                failedEsims.length === totalEsims
                    ? "ALL_FAILED"
                    : "PARTIAL_FAILED",
        };

        // ✉️ Send refund claim email to admin
        await sendRefundClaimEmail(user, order, refundPayload.claimReason, order?.email);

        return res.status(200).json({
            message: "Refund claim submitted successfully. Our team will review it shortly.",
            status: "success"
        });
    } catch (error: any) {
        console.error("❌ Error processing refund claim:", error.message);
        return res.status(500).json({ message: "Internal server error" });
    }
};

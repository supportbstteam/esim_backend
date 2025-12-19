import { Response } from "express";
import { AppDataSource } from "../data-source";
import { Order, ORDER_STATUS } from "../entity/order.entity";
import { CartItem } from "../entity/CartItem.entity";
import { sendRefundClaimEmail } from "../utils/email";

/**
 * 💰 Controller: Claim Refund for an Order
 * @route POST /api/refund/claim
 */
export const claimRefund = async (req: any, res: Response) => {
  try {
    const user = req.user;
    const { orderId, message } = req.body;

    if (!orderId) {
      return res.status(400).json({ message: "orderId is required" });
    }

    /* -------------------- Fetch Order -------------------- */
    const orderRepo = AppDataSource.getRepository(Order);
    const cartItemRepo = AppDataSource.getRepository(CartItem);

    const order = await orderRepo.findOne({
      where: { id: orderId },
      relations: [
        "user",
        "transaction",
        "transaction.cart",
        "esims",
      ],
    });

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    /* -------------------- Ownership Check -------------------- */
    if (!order.user || order.user.id !== user.id) {
      return res
        .status(403)
        .json({ message: "You cannot claim refund for this order" });
    }

    const cart = order.transaction?.cart;
    if (!cart) {
      return res
        .status(400)
        .json({ message: "Cart not found for this order" });
    }

    /* -------------------- COMPLETED = no refund -------------------- */
    if (order.status === ORDER_STATUS.COMPLETED) {
      return res.status(400).json({
        message: "Order completed successfully. Refund not applicable.",
      });
    }

    /* -------------------- Load Cart Items -------------------- */
    const cartItems = await cartItemRepo.find({
      where: {
        cartId: cart.id,
        isDeleted: false,
      },
      relations: ["plan", "esims"],
    });

    if (!cartItems.length) {
      return res
        .status(400)
        .json({ message: "No cart items found" });
    }

    /* -------------------- Determine Refundable Plans -------------------- */
    let refundableCartItems: CartItem[] = [];

    if (order.status === ORDER_STATUS.FAILED) {
      // 🔴 All plans failed
      refundableCartItems = cartItems;
    }

    if (order.status === ORDER_STATUS.PARTIAL) {
      // 🟡 Refund only failed plans
      refundableCartItems = cartItems.filter((item) => {
        if (!item.esims || item.esims.length === 0) return true;

        const hasSuccessEsim = item.esims.some(
          (e) => e.iccid && e.qrCodeUrl
        );

        return !hasSuccessEsim;
      });
    }

    if (!refundableCartItems.length) {
      return res.status(400).json({
        message: "No refundable plans found for this order",
      });
    }

    /* -------------------- Build Refund Payload -------------------- */
    const refundPlans = refundableCartItems.map((item) => ({
      cartItemId: item.id,
      planId: item.planId,
      planName: item.plan?.name,
      quantity: item.quantity,
      esimCreated: item.esims?.length ?? 0,
    }));

    /* -------------------- Send Refund Email -------------------- */
    await sendRefundClaimEmail(
      user,
      order,
      message || "No message provided",
      order.email,
      {
        orderStatus: order?.status === "FAILED" ? "FAILED" : "PARTIAL",
        refundPlans,
      }
    );

    /* -------------------- Response -------------------- */
    return res.status(200).json({
      status: "success",
      message: "Refund claim submitted successfully. Our team will review it.",
      refundablePlans: refundPlans,
    });
  } catch (error: any) {
    console.error("❌ Refund claim error:", error);
    return res.status(500).json({
      message: "Internal server error",
    });
  }
};

import axios from "axios";
import { AppDataSource } from "../data-source";
import { Transaction } from "../entity/Transactions.entity";
import { Cart } from "../entity/Carts.entity";
import { Order, OrderType, ORDER_STATUS } from "../entity/order.entity";
import { sendOrderEmail } from "./email";
import { Esim } from "../entity/Esim.entity";
import { User } from "../entity/User.entity";
import { getValidThirdPartyToken } from "../middlewares/tokenTruism.service";

export const createOrderAfterPayment = async (transaction: Transaction, userId: string) => {
  console.log("🟣 [createOrderAfterPayment] Start | Transaction:", transaction?.id, "| User:", userId);

  const cartRepo = AppDataSource.getRepository(Cart);
  const orderRepo = AppDataSource.getRepository(Order);
  const esimRepo = AppDataSource.getRepository(Esim);
  const userRepo = AppDataSource.getRepository(User);

  let mainOrder: Order | null = null;
  let latestCart: Cart | null = null;

  try {
    // 🔹 Step 1: Validate user + transaction
    const user = await userRepo.findOneBy({ id: userId });
    if (!user) throw new Error("User not found");
    if (!transaction) throw new Error("Transaction not found");
    if (transaction.status !== "SUCCESS") throw new Error(`Invalid transaction status: ${transaction.status}`);

    latestCart = transaction.cart ?? null;
    if (!latestCart || latestCart.isDeleted || latestCart.isCheckedOut || latestCart.isError) {
      throw new Error("No valid cart found for this transaction");
    }

    const validCartItems = latestCart.items.filter((i) => !i.isDeleted && i.plan);
    if (!validCartItems.length) throw new Error("No valid cart items found");

    console.log(`🛒 Valid Cart Found | Items: ${validCartItems.length}`);

    // 🔹 Step 2: Create new order
    mainOrder = orderRepo.create({
      user: transaction.user,
      transaction,
      name: `${user.firstName || ""} ${user.lastName || ""}`.trim(),
      email: user?.email || "",
      phone: user?.phone || "",
      status: ORDER_STATUS.PROCESSING,
      activated: false,
      totalAmount: transaction.amount,
      country: validCartItems[0].plan.country,
      type: OrderType.ESIM,
    });

    await orderRepo.save(mainOrder);
    console.log("✅ Order created successfully:", mainOrder.id, "| Code:", mainOrder.orderCode);

    // 🔹 Step 3: Get valid third-party token
    console.log("🔑 Fetching valid Turisim token...");
    const token = await getValidThirdPartyToken();
    const headers = { Authorization: `Bearer ${token}` };
    console.log("✅ Valid token acquired");

    const createdEsims: Esim[] = [];
    const totalEsimsInCart = validCartItems.reduce((acc, item) => acc + item.quantity, 0);

    // 🔹 Step 4: Process eSIMs
    for (const item of validCartItems) {
      const plan = item.plan;

      for (let i = 0; i < item.quantity; i++) {
        try {
          console.log(`⚙️ Processing eSIM for plan: ${plan.name} (${i + 1}/${item.quantity})`);

          // Reserve eSIM
          const reserveResponse = await axios.get(
            `${process.env.TURISM_URL}/v2/sims/reserve?product_plan_id=${plan.planId}`,
            { headers }
          );
          const reserveId = reserveResponse.data?.data?.id;
          if (!reserveId) throw new Error("Failed to reserve SIM - no ID received");

          // Purchase eSIM
          const purchaseResponse = await axios.post(
            `${process.env.TURISM_URL}/v2/sims/${reserveId}/purchase`,
            {},
            { headers }
          );
          const esimData = purchaseResponse.data?.data;
          console.log("✅ eSIM purchased successfully:", esimData?.id);

          // Save eSIM
          const esim = esimRepo.create({
            externalId: esimData.id?.toString(),
            iccid: esimData.iccid || null,
            qrCodeUrl: esimData.qr_code_url || null,
            networkStatus: esimData.network_status || null,
            statusText: esimData.status_text || null,
            productName: esimData.name || plan.name,
            currency: esimData.currency || null,
            price: parseFloat(esimData.price) || parseFloat(plan.price),
            validityDays: esimData.validity_days || plan.validityDays,
            dataAmount: esimData.data || 0,
            callAmount: esimData.call || 0,
            smsAmount: esimData.sms || 0,
            isActive: esimData.network_status !== "NOT_ACTIVE",
            startDate: new Date(),
            cartItem: item,
            endDate: new Date(
              new Date().setDate(new Date().getDate() + (esimData.validity_days || plan.validityDays || 30))
            ),
            country: plan.country,
            user: transaction.user,
            plans: [plan],
            order: mainOrder,
          });

          const savedEsim = await esimRepo.save(esim);
          createdEsims.push(savedEsim);
        } catch (innerErr: any) {
          console.error(`❌ eSIM creation failed for plan ${plan.name}:`, innerErr.message);

          // 🔸 Always create a failed eSIM entry for consistency
          const failedEsim = esimRepo.create({
            externalId: null,
            iccid: null,
            qrCodeUrl: null,
            productName: plan.name,
            isActive: false,
            startDate: null,
            endDate: null,
            country: plan.country,
            user: transaction.user,
            plans: [plan],
            order: mainOrder,
          });

          await esimRepo.save(failedEsim);
          mainOrder.errorMessage = `${mainOrder.errorMessage || ""}\n${innerErr.message}`;
          await orderRepo.save(mainOrder);
        }
      }
    }

    // 🔹 Step 5: Update Order Status
    const successCount = createdEsims.length;
    const failedCount = totalEsimsInCart - successCount;

    if (successCount === totalEsimsInCart) {
      mainOrder.status = ORDER_STATUS.COMPLETED;
      mainOrder.activated = true;
    } else if (successCount > 0 && failedCount > 0) {
      mainOrder.status = ORDER_STATUS.PARTIAL;
      mainOrder.activated = true;
    } else {
      mainOrder.status = ORDER_STATUS.FAILED;
      mainOrder.activated = false;
    }

    await orderRepo.save(mainOrder);
    console.log(`📊 eSIM Summary: Success=${successCount} | Failed=${failedCount} | Final Order Status=${mainOrder.status}`);

    // 🔹 Step 6: Mark cart as checked out
    latestCart.isCheckedOut = true;
    await cartRepo.save(latestCart);
    console.log("🛒 Cart marked as checked out");

    // 🔹 Step 7: Send confirmation email
    try {
      console.log("📧 Sending order confirmation email...");
      await sendOrderEmail(
        user.email,
        `${user.firstName} ${user.lastName}`,
        {
          id: mainOrder.id,
          totalAmount: Number(mainOrder.totalAmount),
          activated: mainOrder.activated,
          esims: createdEsims,
          orderCode: mainOrder.orderCode,
        },
        (mainOrder?.status === "COMPLETED")
          ? "COMPLETED"
          : (mainOrder?.status === "FAILED")
          ? "FAILED"
          : "PARTIAL"
      );
      console.log("✅ Confirmation email sent to:", user.email);
    } catch (err: any) {
      console.error("⚠️ Email sending failed:", err.message);
    }

    console.log("🎯 [createOrderAfterPayment] Completed successfully.");
    return { order: mainOrder, summary: { totalEsimsInCart, successCount, failedCount } };
  } catch (err: any) {
    console.error("💥 [createOrderAfterPayment] Error:", err.message);
    if (mainOrder) {
      mainOrder.status = ORDER_STATUS.FAILED;
      mainOrder.errorMessage = err.message;
      await orderRepo.save(mainOrder);
    }
    throw err;
  }
};

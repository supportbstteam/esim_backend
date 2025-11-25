import { Response } from "express";
import axios from "axios";
import { User } from "../../entity/User.entity";
import { Order, ORDER_STATUS, OrderType } from "../../entity/order.entity";
import { Esim } from "../../entity/Esim.entity";
import { Transaction, TransactionStatus } from "../../entity/Transactions.entity";
import { AppDataSource } from "../../data-source";
import { Cart } from "../../entity/Carts.entity";
import { CartItem } from "../../entity/CartItem.entity";
import { Refund } from "../../entity/Refund.entity";
import { sendAdminOrderNotification, sendOrderEmail } from "../../utils/email";
import { EsimTopUp } from "../../entity/EsimTopUp.entity";

export const postOrder = async (req: any, res: Response) => {
  const requestId = `postOrder-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  console.log(`[${requestId}] ▶ ENTER postOrder`, { body: req.body, user: req.user?.id });

  const { transactionId } = req.body;
  const userId = req.user?.id;
  const thirdPartyToken = { Authorization: `Bearer ${req.thirdPartyToken}` };

  console.log(`[${requestId}] 🧾 Received transactionId:`, transactionId, "userId:", userId);

  if (!transactionId || !userId) {
    console.log(`[${requestId}] ❌ Missing transactionId or userId`, { transactionId, userId });
    return res.status(400).json({ message: "transactionId and userId are required" });
  }

  const transactionRepo = AppDataSource.getRepository(Transaction);
  const cartRepo = AppDataSource.getRepository(Cart);
  const cartItemRepo = AppDataSource.getRepository(CartItem);
  const orderRepo = AppDataSource.getRepository(Order);
  const esimRepo = AppDataSource.getRepository(Esim);
  const userRepo = AppDataSource.getRepository(User);

  let latestCart: Cart | null = null;
  let mainOrder: Order | null = null;

  try {
    console.log(`[${requestId}] 🔎 Step 1: Fetch transaction with relations`);
    const transaction = await transactionRepo.findOne({
      where: { id: transactionId },
      relations: ["user", "cart", "cart.items", "cart.items.plan", "cart.items.plan.country"],
    });
    console.log(`[${requestId}] 🔁 transaction fetched:`, !!transaction);

    console.log(`[${requestId}] 🔎 Step 1b: Fetch user`);
    const user = await userRepo.findOneBy({ id: userId });
    console.log(`[${requestId}] 🔁 user fetched:`, !!user);

    if (!user) {
      console.log(`[${requestId}] ❌ User not found`, { userId });
      throw new Error("User not found");
    }
    if (!transaction) {
      console.log(`[${requestId}] ❌ Transaction not found`, { transactionId });
      throw new Error("Transaction not found");
    }
    console.log(`[${requestId}] ℹ transaction.status:`, transaction.status);
    if (transaction.status !== "SUCCESS") {
      console.log(`[${requestId}] ❌ Transaction not SUCCESS`, { status: transaction.status });
      throw new Error(`Invalid transaction status: ${transaction.status}`);
    }

    latestCart = transaction.cart ?? null;
    console.log(`[${requestId}] 🔎 latestCart present:`, !!latestCart);

    if (!latestCart || latestCart.isDeleted || latestCart.isCheckedOut || latestCart.isError) {
      console.log(
        `[${requestId}] ❌ No valid cart found or cart invalid flags`,
        { latestCartExists: !!latestCart, isDeleted: latestCart?.isDeleted, isCheckedOut: latestCart?.isCheckedOut, isError: latestCart?.isError }
      );
      throw new Error("No valid cart found for this transaction");
    }

    const validCartItems = latestCart.items.filter((i) => !i.isDeleted);
    console.log(`[${requestId}] 🔎 validCartItems count:`, validCartItems.length);
    if (!validCartItems.length) {
      console.log(`[${requestId}] ❌ No valid cart items found`);
      throw new Error("No valid cart items found");
    }

    // Idempotency check: ensure there's no existing order for this transaction
    console.log(`[${requestId}] 🔐 Checking existing order for transaction`);
    const alreadyOrder = await orderRepo.findOne({
      where: { transaction: { transactionId } },   // compare with paymentIntent.id
      relations: ["esims", "user"],
    });


    if (alreadyOrder) {
      console.log(`[${requestId}] ⚠️ Existing order detected for this transaction. Returning existing order.`, { orderId: alreadyOrder.id });
      return res.status(200).json({
        message: "Order already processed",
        order: alreadyOrder,
      });
    }

    // 🔹 Step 2: Create new order
    console.log(`[${requestId}] ✍️ Creating new order record`);
    mainOrder = orderRepo.create({
      user: transaction.user,
      transaction,
      name: `${user.firstName || ""} ${user.lastName || ""}`.trim(),
      email: user?.email || "",
      phone: user?.phone || "",
      status: "processing",
      activated: false,
      totalAmount: transaction?.amount,
      country: validCartItems[0].plan.country,
      type: OrderType.ESIM,
    });

    console.log(`[${requestId}] 💾 Saving new order to DB (pre-save)`, { orderPreview: mainOrder });
    await orderRepo.save(mainOrder);
    console.log(`[${requestId}] ✅ Order saved`, { orderId: mainOrder.id });

    const createdEsims: Esim[] = [];
    const totalEsimsInCart = validCartItems.reduce((acc, item) => acc + item.quantity, 0);
    console.log(`[${requestId}] ℹ totalEsimsInCart:`, totalEsimsInCart);

    // 🔹 Step 3: Sequentially process each cart item
    for (const item of validCartItems) {
      console.log(`[${requestId}] 🔁 Processing cartItem`, { cartItemId: item.id, planId: item.plan?.id, quantity: item.quantity });

      const plan = item.plan;

      // Safety: check if any eSIMs already exist for this cartItem (prevent duplicates)
      console.log(`[${requestId}] 🔐 Checking existing eSIMs for cartItem ${item.id}`);
      const existingEsimsForCartItem = await esimRepo.find({ where: { cartItem: { id: item.id } } });
      if (existingEsimsForCartItem && existingEsimsForCartItem.length > 0) {
        console.log(`[${requestId}] ⚠️ Found existing eSIM(s) for cartItem - skipping creation for this item.`, { existingCount: existingEsimsForCartItem.length });
        // Add any already saved ones to createdEsims to keep counts consistent (optional)
        createdEsims.push(...existingEsimsForCartItem);
        continue;
      }

      for (let i = 0; i < item.quantity; i++) {
        console.log(`[${requestId}] ▶ Start create loop for cartItem ${item.id} - iteration ${i + 1}/${item.quantity}`);

        try {
          console.log(`[${requestId}] 🔹 Reserving SIM from third-party for planId: ${plan.planId}`);
          const reserveResponse = await axios.get(
            `${process.env.TURISM_URL}/v2/sims/reserve?product_plan_id=${plan.planId}`,
            { headers: thirdPartyToken }
          );
          console.log(`[${requestId}] 🔹 reserveResponse received`, { status: reserveResponse.status, dataExists: !!reserveResponse.data });

          const externalReserveId = reserveResponse.data?.data?.id;
          console.log(`[${requestId}] 🔹 externalReserveId:`, externalReserveId);

          if (!externalReserveId) {
            throw new Error("Failed to reserve SIM: no externalReserveId returned");
          }

          console.log(`[${requestId}] 🔹 Purchasing SIM with externalReserveId: ${externalReserveId}`);
          const createSimResponse = await axios.post(
            `${process.env.TURISM_URL}/v2/sims/${externalReserveId}/purchase`,
            {},
            { headers: thirdPartyToken }
          );
          console.log(`[${requestId}] 🔹 purchase response received`, { status: createSimResponse.status, dataExists: !!createSimResponse.data });

          const esimData = createSimResponse.data?.data;
          console.log(`[${requestId}] 🔹 esimData extracted`, { esimDataSnippet: { id: esimData?.id, iccid: esimData?.iccid } });

          // Create eSIM entity
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
            endDate: new Date(
              new Date().setDate(new Date().getDate() + (esimData.validity_days || plan.validityDays || 30))
            ),
            country: plan.country,
            user: transaction.user,
            plans: [plan],
            order: mainOrder,
            cartItem: item,
          });

          console.log(`[${requestId}] 💾 Saving eSIM to DB (pre-save)`, { productName: esim.productName, cartItemId: item.id });
          const savedEsim = await esimRepo.save(esim);
          console.log(`[${requestId}] ✅ eSIM saved`, { esimId: savedEsim.id, externalId: savedEsim.externalId });

          createdEsims.push(savedEsim);

          // Update running order total (mirrors previous logic)
          const transactionAmount = Number(transaction?.amount) || 0;
          mainOrder.totalAmount = isFinite(transactionAmount) ? transactionAmount : 0;
          console.log(`[${requestId}] ℹ Updated mainOrder.totalAmount to`, mainOrder.totalAmount);

        } catch (innerErr: any) {
          console.error(`[${requestId}] ⚠️ eSIM creation failed for plan: ${plan?.name}`, innerErr?.message || innerErr);
          try {
            // Create minimal empty eSIM linked to cartItem
            const failedEsim = esimRepo.create({
              externalId: null,
              iccid: null,
              qrCodeUrl: null,
              productName: plan?.name,
              isActive: false,
              startDate: null,
              endDate: null,
              country: plan?.country,
              user: transaction.user,
              plans: [plan],
              order: mainOrder,
              cartItem: item,
            });

            console.log(`[${requestId}] 💾 Saving failed placeholder eSIM to DB for cartItem ${item.id}`);
            await esimRepo.save(failedEsim);
            console.log(`[${requestId}] ✅ Failed placeholder eSIM saved`);
          } catch (saveErr: any) {
            console.error(`[${requestId}] ❌ Failed to save failed placeholder eSIM`, saveErr?.message || saveErr);
          }

          mainOrder.errorMessage = `${mainOrder.errorMessage || ""}\n${innerErr.message || innerErr}`;
          console.log(`[${requestId}] ℹ mainOrder.errorMessage updated`);
          await orderRepo.save(mainOrder);
          console.log(`[${requestId}] ✅ mainOrder saved after error update`);
        }
      } // end quantity loop
    } // end cart items loop

    // 🔹 Step 4: Final order status resolution
    console.log(`[${requestId}] 🔍 Resolving final order status`, { createdEsimsCount: createdEsims.length, totalEsimsInCart });
    if (createdEsims.length === 0) {
      mainOrder.status = ORDER_STATUS.FAILED;
      mainOrder.activated = false;
    } else if (createdEsims.length < totalEsimsInCart) {
      mainOrder.status = ORDER_STATUS.PARTIAL;
      mainOrder.activated = true;
    } else {
      mainOrder.status = ORDER_STATUS.COMPLETED;
      mainOrder.activated = true;
    }

    console.log(`[${requestId}] 💾 Saving final order status`, { status: mainOrder.status, activated: mainOrder.activated });
    await orderRepo.save(mainOrder);

    // Mark cart checked out
    latestCart.isCheckedOut = true;
    console.log(`[${requestId}] 💾 Marking cart checked out`, { cartId: latestCart.id });
    await cartRepo.save(latestCart);

    // 🔹 Step 5: Send confirmation email
    console.log(`[${requestId}] ✉️ Sending order email to`, user.email);
    try {
      await sendOrderEmail(
        user.email,
        `${user.firstName} ${user.lastName}`,
        {
          id: mainOrder.id,
          totalAmount: Number(mainOrder.totalAmount) || 0,
          activated: mainOrder.activated,
          esims: createdEsims,
          orderCode: mainOrder?.orderCode,
        },
        (mainOrder?.status === "COMPLETED") ? "COMPLETED" : (mainOrder?.status === "FAILED") ? "FAILED" : "PARTIAL"
      );
      console.log(`[${requestId}] ✅ Order email sent`);
    } catch (emailErr: any) {
      console.error(`[${requestId}] ❌ Failed to send order email`, emailErr?.message || emailErr);
    }

    // 🔹 Step 6: Dynamic response based on final state
    const responseSummary = {
      totalEsims: totalEsimsInCart,
      successCount: createdEsims.length,
      failedCount: totalEsimsInCart - createdEsims.length,
    };

    console.log(`[${requestId}] ✅ Final responseSummary`, responseSummary);

    const statusMapping: Record<string, { code: number; msg: string }> = {
      completed: { code: 201, msg: "Order completed successfully" },
      partial: { code: 207, msg: "Order partially completed. Some eSIMs failed." },
      failed: { code: 500, msg: "Order failed. No eSIMs could be created." },
    };

    const { code, msg } = statusMapping[mainOrder.status.toLowerCase()] || statusMapping.failed;
    console.log(`[${requestId}] 🔚 Returning response`, { code, msg });

    return res.status(code).json({
      message: msg,
      order: { ...mainOrder, esims: createdEsims, transaction },
      summary: responseSummary,
      error:
        mainOrder.status === "failed" || mainOrder.status === "partial"
          ? mainOrder.errorMessage || "Some eSIMs failed to process."
          : null,
    });
  } catch (err: any) {
    console.error(`[${requestId}] ❌ postOrder error:`, err?.message || err);
    if (mainOrder) {
      try {
        mainOrder.status = "failed";
        mainOrder.errorMessage = err.message;
        console.log(`[${requestId}] 💾 Saving failed mainOrder in catch`);
        await orderRepo.save(mainOrder);
        console.log(`[${requestId}] ✅ mainOrder saved in catch`);
      } catch (saveErr: any) {
        console.error(`[${requestId}] ❌ Failed to save mainOrder in catch`, saveErr?.message || saveErr);
      }
    }
    console.log(`[${requestId}] 🔚 Exiting postOrder with 500`);
    return res.status(500).json({ message: "Order failed", error: err.message });
  }
};

export const getOrderListByUser = async (req: any, res: Response) => {
  const { id, role } = req.user;
  if (!id || role !== "user") return res.status(401).json({ message: "Unauthorized", status: "error" });

  try {
    const orderRepo = AppDataSource.getRepository(Order);
    const orders = await orderRepo.find({
      where: { user: { id } },
      relations: ["esims", "transaction", "transaction.user", "transaction.charges", "country"],
      order: { createdAt: "DESC" },
    });

    const formattedOrders = orders.map(order => {
      const esims = Array.isArray(order.esims) ? order.esims : [];
      return {
        id: order.id || order?.orderCode,
        code: order?.orderCode || order.id,
        planNames: esims.map(e => e.productName || "N/A"),
        totalPlans: esims.length,
        totalData: esims.reduce((acc, e) => acc + (e.dataAmount || 0), 0),
        totalSms: esims.reduce((acc, e) => acc + (e.smsAmount || 0), 0),
        totalAmount: order?.totalAmount,
        country: order.country?.name || "Unknown",
        isoCode: order.country?.isoCode || null,
        phoneCode: order.country?.phoneCode || null,
        isActive: !!order.activated,
        status: order.status,
        errorMessage: order.errorMessage || null,
        createdAt: order.createdAt,
      };
    });

    return res.status(200).json({ status: "success", message: "Orders fetched successfully", data: formattedOrders });
  } catch (err: any) {
    console.error("❌ Error fetching orders:", err);
    return res.status(500).json({ status: "error", message: "Failed to fetch orders", error: err.message });
  }
};

export const getOrderDetailsByUser = async (req: any, res: Response) => {
  const { id, role } = req.user;
  const { orderId } = req.params;

  if (!id || role !== "user") {
    return res.status(401).json({ message: "Unauthorized", status: "error" });
  }

  if (!orderId) {
    return res
      .status(400)
      .json({ message: "Order ID is required", status: "error" });
  }

  try {
    const orderRepo = AppDataSource.getRepository(Order);
    const esimTopupRepo = AppDataSource.getRepository(EsimTopUp);

    const order = await orderRepo.findOne({
      where: { id: orderId, user: { id } },
      relations: [
        "transaction",
        "transaction.user",
        "transaction.charges",
        "country",
      ],
    });

    if (!order)
      return res
        .status(404)
        .json({ message: "Order not found", status: "error" });

    // 🧠 CASE 1: Top-up order → Fetch from EsimTopUp table
    if (order.orderCode?.startsWith("ETUP") && order.type === "top up") {
      const esimTopUps = await esimTopupRepo.find({
        where: { order: { id: order.id } },
        relations: [
          "esim",
          "esim.country",
          "esim.user",
          "topup",
          "topup.country",
        ],
      });

      const esims = esimTopUps.map((et) => ({
        ...et.esim,
        topUps: et.topup ? [et.topup] : [],
      }));

      const formattedOrder = {
        ...order,
        esims,
      };

      return res.status(200).json({
        message: "Top-up order details fetched successfully",
        status: "success",
        data: formattedOrder,
      });
    }

    // 🧠 CASE 2: Normal eSIM order → Fetch as before
    const fullOrder = await orderRepo.findOne({
      where: { id: orderId, user: { id } },
      relations: [
        "esims",
        "esims.topupLinks",
        "esims.topupLinks.topup",
        "transaction",
        "transaction.user",
        "transaction.charges",
        "country",
      ],
    });

    if (!fullOrder) {
      return res
        .status(404)
        .json({ message: "Order not found", status: "error" });
    }

    const formattedOrder = {
      ...fullOrder,
      esims: fullOrder.esims.map((esim) => ({
        ...esim,
        topUps: esim.topupLinks?.map((link) => link.topup) || [],
      })),
    };

    return res.status(200).json({
      message: "Order details fetched successfully",
      status: "success",
      data: formattedOrder,
    });
  } catch (err: any) {
    console.error("Error fetching order details:", err);
    return res.status(500).json({
      message: "Failed to fetch order details",
      status: "error",
      error: err.message,
    });
  }
};


export const postTransaction = async (req: any, res: Response) => {

}


// -------------------- plan -------------
export const getUserAllSims = async (req: any, res: Response) => {
  const { id: userId, role } = req.user;
  const thirdPartyToken = { Authorization: `Bearer ${req.thirdPartyToken}` };

  if (!userId || role !== "user")
    return res.status(401).json({ message: "Unauthorized", status: "error" });

  try {
    const esimRepo = AppDataSource.getRepository(Esim);

    // 🔹 Fetch all user's eSIMs
    const esims = await esimRepo.find({
      where: { user: { id: userId } },
      relations: ["order", "order.transaction", "order.country", "country"],
      order: { createdAt: "DESC" },
    });

    if (!esims.length)
      return res
        .status(404)
        .json({ message: "No eSIMs found for this user", status: "error" });

    const updatedEsims: any[] = [];

    // 🔁 For each eSIM, fetch live status and update DB
    for (const esim of esims) {
      if (!esim.iccid) {
        updatedEsims.push(esim);
        continue;
      }

      try {
        const { data: simResponse } = await axios.get(
          `${process.env.TURISM_URL}/v2/sims/${esim.iccid}/usage`,
          { headers: thirdPartyToken }
        );

        const simData = simResponse?.data?.data;
        if (!simData) {
          updatedEsims.push(esim);
          continue;
        }

        // 🔹 Extract live data
        const {
          remaining_days,
          total_data,
          status,
          status_text,
          is_unlimited,
          remaining_data,
        } = simData;

        // 🔹 Update DB values
        esim.networkStatus = status || esim.networkStatus;
        esim.statusText = status_text || esim.statusText;
        esim.isActive = status_text?.toLowerCase() === "active";

        esim.validityDays = remaining_days ?? esim.validityDays;
        esim.dataAmount = total_data ? total_data / 1024 : esim.dataAmount; // MB → GB (adjust if needed)

        await esimRepo.save(esim);

        updatedEsims.push(esim);
      } catch (apiErr: any) {
        console.error(`Failed to update eSIM ${esim.iccid}:`, apiErr.message);
        updatedEsims.push(esim); // still include old data if API fails
      }
    }

    // 🟢 Return final response
    return res.status(200).json({
      message: "All eSIMs fetched and updated successfully",
      status: "success",
      data: updatedEsims,
    });
  } catch (err: any) {
    console.error("Error fetching all eSIMs:", err);
    return res.status(500).json({
      message: "Failed to fetch all eSIMs",
      status: "error",
      error: err.message,
    });
  }
};

export const getUserEsimDetails = async (req: any, res: Response) => {
  const { id: userId, role } = req.user;
  const { esimId } = req.params;
  const thirdPartyToken = { Authorization: `Bearer ${req.thirdPartyToken}` };

  if (!userId || role !== "user") {
    return res.status(401).json({ message: "Unauthorized", status: "error" });
  }

  if (!esimId) {
    return res
      .status(400)
      .json({ message: "eSIM ID is required", status: "error" });
  }

  try {
    const esimRepo = AppDataSource.getRepository(Esim);
    const orderRepo = AppDataSource.getRepository(Order);

    // 🔹 Find eSIM that belongs to the current user
    const esim = await esimRepo.findOne({
      where: { id: esimId, user: { id: userId } },
      relations: [
        "order",
        "order.country",
        "order.transaction",
        "order.transaction.user",
        "order.transaction.charges",
        "country",
      ],
    });

    if (!esim) {
      return res
        .status(404)
        .json({ message: "eSIM not found", status: "error" });
    }

    // if (!esim.iccid) {
    //   return res
    //     .status(404)
    //     .json({ message: "ICCID not found", status: "error" });
    // }

    // 🔹 Fetch live eSIM data from external API

    let simResponse = null;

    if (esim?.iccid) {
      simResponse = (await axios.get(
        `${process.env.TURISM_URL}/v2/sims/${esim.iccid}/usage`,
        { headers: thirdPartyToken }
      )).data;

    }

    console.log("----- simResponse?.data?.data -----", simResponse?.data?.data);

    const simData = simResponse?.data?.data || esim;
    if (!simData) {
      return res.status(404).json({
        message: "Invalid response from SIM provider",
        status: "error",
      });
    }

    // 🔹 Extract values to update
    const {
      remaining_days,
      total_data,
      status,
      status_text,
      is_unlimited,
      expired_at,
      product_plan_id,
      remaining_data,
      product_status,
    } = simData;

    // 🔹 Update eSIM details in the DB (network + stats)
    esim.networkStatus = status || esim.networkStatus;
    esim.statusText = status_text || esim.statusText;

    // Example logic: set active if status is active
    esim.isActive = status_text?.toLowerCase() === "active";

    // 🔹 Update plan details
    // Use fallback values from DB if missing in API response
    esim.validityDays = remaining_days ?? esim.validityDays;
    esim.dataAmount = total_data ? total_data / 1024 : esim.dataAmount; // convert MB->GB if needed
    esim.callAmount = 0;
    esim.smsAmount = 0;

    await esimRepo.save(esim);

    // 🔹 Format and return clean eSIM details
    const formattedOrder = {
      ...esim.order,
      esims: [
        {
          id: esim.id,
          startDate: esim.startDate,
          endDate: esim.endDate,
          isActive: esim.isActive,
          isDeleted: esim.isDeleted,
          externalId: esim.externalId,
          iccid: esim.iccid,
          qrCodeUrl: esim.qrCodeUrl || "",
          networkStatus: esim.networkStatus,
          statusText: esim.statusText,
          productName: esim.productName,
          currency: esim.currency,
          price: esim.price,
          validityDays: esim.validityDays,
          dataAmount: esim.dataAmount,
          callAmount: esim.callAmount,
          smsAmount: esim.smsAmount,
          createdAt: esim.createdAt,
          updatedAt: esim.updatedAt,
          country: esim.country,
          order: esim.order,
        },
      ],
    };

    return res.status(200).json({
      message: "eSIM details fetched successfully",
      status: "success",
      data: formattedOrder,
    });
  } catch (err: any) {
    console.error("Error fetching eSIM details:", err);
    return res.status(500).json({
      message: "Failed to fetch eSIM details",
      status: "error",
      error: err.message,
    });
  }
};

export const getUserSimSummary = async (req: any, res: Response) => {
  console.log("=== HIT getUserSimSummary route ===");
  console.log("Request user:", req.user);

  // return res.status(200).json({ message: "eSIM summary fetched successfully", status: "success", data: {} });

  const { id, role } = req.user;

  if (!id || role !== "user") {
    console.log("Unauthorized access attempt");
    return res.status(401).json({ message: "Unauthorized", status: "error" });
  }

  try {
    const esimRepo = AppDataSource.getRepository(Esim);
    console.log("Repository initialized:", !!esimRepo);

    // Fetch all eSIMs (linked directly or through an order)
    const esims = await esimRepo.find({
      where: [
        { user: { id } },
        { order: { user: { id } } },
      ],
      relations: ["user", "plans", "order", "order.user", "country"],
      order: { createdAt: "DESC" },
    });

    console.log("------- esims fetched for summary --------", esims.length);
    if (esims.length > 0) {
      console.log("First eSIM record:", esims[0]);
    }

    if (!esims.length) {
      console.log("No eSIMs found for this user");
      return res.status(200).json({
        message: "No eSIMs found for this user",
        status: "success",
        data: {
          totalSims: 0,
          activeSims: 0,
          inactiveSims: 0,
          totalData: 0,
          planSummary: [],
        },
      });
    }

    // --- Stats ---
    const totalSims = esims.length;
    const activeSims = esims.filter((e) => e.isActive).length;
    const inactiveSims = totalSims - activeSims;

    console.log("Stats: totalSims =", totalSims, "activeSims =", activeSims, "inactiveSims =", inactiveSims);

    // --- Group by Plan ---
    const planSummary = new Map<
      string,
      {
        planId: string;
        name: string;
        simsBought: number;
        totalData: number;
        isUnlimited: boolean;
      }
    >();

    for (const esim of esims) {
      for (const plan of esim.plans || []) {
        if (!planSummary.has(plan.id)) {
          planSummary.set(plan.id, {
            planId: plan.id,
            name: plan.title || plan.name,
            simsBought: 0,
            totalData: 0,
            isUnlimited: plan.isUnlimited,
          });
        }

        const summary = planSummary.get(plan.id)!;
        summary.simsBought += 1;

        if (!plan.isUnlimited && plan.data) {
          summary.totalData += Number(plan.data);
        }
      }
    }

    const planSummaryArray = Array.from(planSummary.values());
    const totalData = planSummaryArray.reduce((sum, p) => sum + p.totalData, 0);
    console.log("Plan summary:", planSummaryArray);
    console.log("Total data across all plans:", totalData);

    // --- Response ---
    return res.status(200).json({
      message: "eSIM summary fetched successfully",
      status: "success",
      data: {
        totalSims,
        activeSims,
        inactiveSims,
        totalData,
        planSummary: planSummaryArray,
      },
    });
  } catch (err: any) {
    console.error("Error fetching eSIM summary:", err);
    return res.status(500).json({
      message: "Failed to fetch eSIM summary",
      status: "error",
      error: err.message,
    });
  }
};

export const postUserClaimRefund = async (req: any, res: Response) => {
  const { id, role } = req.user;

  // 🔐 Validate user identity
  if (!id || role !== "user") {
    return res.status(401).json({
      message: "Unauthorized! Invalid account credentials.",
    });
  }

  const { orderId, transactionId, message, firstName, lastName, email, phone } = req.body;

  // 🧾 Basic data validation
  if (!orderId || !transactionId) {
    return res.status(400).json({
      message: "Order ID and Transaction ID are required.",
    });
  }

  try {
    const userRepo = AppDataSource.getRepository(User);
    const orderRepo = AppDataSource.getRepository(Order);
    const transactionRepo = AppDataSource.getRepository(Transaction);
    const refundRepo = AppDataSource.getRepository(Refund);

    // 🔍 Fetch user
    const user = await userRepo.findOne({
      where: { id },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    // 🔍 Fetch order
    const order = await orderRepo.findOne({
      where: { id: orderId },
      relations: ["user", "transaction"],
    });

    if (!order) {
      return res.status(404).json({ message: "Order not found." });
    }

    // 🔍 Fetch transaction
    const transaction = await transactionRepo.findOne({
      where: { id: transactionId },
    });

    if (!transaction) {
      return res.status(404).json({ message: "Transaction not found." });
    }

    // 🧠 Business rule validation
    if (
      order.status.toLowerCase() !== "failed" &&
      order?.user?.id !== id &&
      order.transaction.id !== transactionId
    ) {
      return res.status(400).json({
        message: "Refund cannot be claimed for this order.",
      });
    }

    // 🛑 Check if refund already exists for this order
    const existingRefund = await refundRepo.findOne({
      where: { order: { id: orderId }, isDeleted: false },
    });

    // if (existingRefund) {
    //   return res.status(400).json({
    //     message: "Refund already claimed for this order.",
    //   });
    // }

    // 💾 Create new refund record
    const refund = refundRepo.create({
      firstName: firstName || user.firstName,
      lastName: lastName || user.lastName,
      email: email || user.email,
      phone: phone || user?.phone,
      message: message || "User requested a refund.",
      order,
      transaction,
      userId: user?.id,
      isDeleted: false,
      status: "pending",
    });

    await refundRepo.save(refund);

    return res.status(201).json({
      message: "Refund request submitted successfully.",
      data: refund,
    });
  } catch (err: any) {
    console.error("---- error in the claim refund order ------", err);
    return res.status(500).json({
      message: "Something went wrong while processing your refund request.",
      error: err.message,
    });
  }
};

// GET /user/orders/status/:transactionId
export const getOrderStatus = async (req: any, res: Response) => {
  const { transactionId } = req.params;

  // console.log("----- transaction id ----",transactionId);
  const orderRepo = AppDataSource.getRepository(Order);

  const order = await orderRepo.findOne({
    where: { transaction: { id: transactionId } },
    relations: ["transaction"],
  });

  if (!order) {
    return res.status(404).json({ message: "Order not found" });
  }

  res.json({
    status: order.status,
    orderCode: order.orderCode,
    orderId: order.id,
    activated: order.activated,
  });
};


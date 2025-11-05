import { Response } from "express";
import axios from "axios";
import { User } from "../../entity/User.entity";
import { Order, ORDER_STATUS, OrderType } from "../../entity/order.entity";
import { Esim } from "../../entity/Esim.entity";
import { Transaction } from "../../entity/Transactions.entity";
import { AppDataSource } from "../../data-source";
import { Cart } from "../../entity/Carts.entity";
import { CartItem } from "../../entity/CartItem.entity";
import { Refund } from "../../entity/Refund.entity";
import { sendAdminOrderNotification, sendOrderEmail } from "../../utils/email";
import { EsimTopUp } from "../../entity/EsimTopUp.entity";

export const postOrder = async (req: any, res: Response) => {
  const { transactionId } = req.body;
  const userId = req.user?.id;
  const thirdPartyToken = { Authorization: `Bearer ${req.thirdPartyToken}` };

  if (!transactionId || !userId) {
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
    // 🔹 Step 1: Validate transaction + user
    const transaction = await transactionRepo.findOne({
      where: { id: transactionId },
      relations: ["user", "cart", "cart.items", "cart.items.plan", "cart.items.plan.country"],
    });

    const user = await userRepo.findOneBy({ id: userId });
    if (!user) throw new Error("User not found");
    if (!transaction) throw new Error("Transaction not found");
    if (transaction.status !== "SUCCESS") throw new Error(`Invalid transaction status: ${transaction.status}`);

    latestCart = transaction.cart ?? null;
    if (!latestCart || latestCart.isDeleted || latestCart.isCheckedOut || latestCart.isError) {
      throw new Error("No valid cart found for this transaction");
    }

    const validCartItems = latestCart.items.filter((i) => !i.isDeleted);
    if (!validCartItems.length) throw new Error("No valid cart items found");

    // 🔹 Step 2: Create new order
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

    await orderRepo.save(mainOrder);

    const createdEsims: Esim[] = [];
    const totalEsimsInCart = validCartItems.reduce((acc, item) => acc + item.quantity, 0);

    // 🔹 Step 3: Sequentially process each cart item
    for (const item of validCartItems) {
      const plan = item.plan;

      // Create eSIMs one by one — sequential inside quantity loop
      for (let i = 0; i < item.quantity; i++) {
        try {
          // Reserve SIM from third-party
          const reserveResponse = await axios.get(
            `${process.env.TURISM_URL}/v2/sims/reserve?product_plan_id=${plan.planId}`,
            { headers: thirdPartyToken }
          );

          // if (reserveResponse.data?.status !== "success") {
          //   throw new Error(reserveResponse.data?.message || "Failed to reserve eSIM");
          // }

          const externalReserveId = reserveResponse.data.data?.id;

          // Purchase SIM (this must finish before next starts)
          const createSimResponse = await axios.post(
            `${process.env.TURISM_URL}/v2/sims/${externalReserveId}/purchase`,
            {},
            { headers: thirdPartyToken }
          );

          const esimData = createSimResponse.data?.data;

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

          // Save eSIM synchronously
          const savedEsim = await esimRepo.save(esim);
          createdEsims.push(savedEsim);

          // Update running order total
          const transactionAmount = Number(transaction?.amount) || 0;
          mainOrder.totalAmount = isFinite(transactionAmount) ? transactionAmount : 0;

        } catch (innerErr: any) {
          console.error("⚠️ eSIM creation failed for plan:", plan.name, "-", innerErr.message);

          // ✅ Create minimal empty eSIM linked to cartItem
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
            cartItem: item, // ensure linkage
          });

          await esimRepo.save(failedEsim);

          // Don't add it to `createdEsims` (since it’s failed)
          mainOrder.errorMessage = `${mainOrder.errorMessage || ""}\n${innerErr.message}`;
          await orderRepo.save(mainOrder);
        }
      }
    }

    // 🔹 Step 4: Final order status resolution
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

    await orderRepo.save(mainOrder);
    latestCart.isCheckedOut = true;
    await cartRepo.save(latestCart);

    // 🔹 Step 5: Send confirmation email
    await sendOrderEmail(
      user.email,
      `${user.firstName} ${user.lastName}`,
      {
        id: mainOrder.id,
        totalAmount: Number(mainOrder.totalAmount) || 0,
        activated: mainOrder.activated,
        esims: createdEsims,
        orderCode: mainOrder?.orderCode,
        // name:mainOrder?.name
      },
      (mainOrder?.status === "COMPLETED") ? "COMPLETED" : (mainOrder?.status === "FAILED") ? "FAILED" : "PARTIAL"
    );

    // await sendAdminOrderNotification(mainOrder);

    // 🔹 Step 6: Dynamic response based on final state
    const responseSummary = {
      totalEsims: totalEsimsInCart,
      successCount: createdEsims.length,
      failedCount: totalEsimsInCart - createdEsims.length,
    };

    const statusMapping: Record<string, { code: number; msg: string }> = {
      completed: { code: 201, msg: "Order completed successfully" },
      partial: { code: 207, msg: "Order partially completed. Some eSIMs failed." },
      failed: { code: 500, msg: "Order failed. No eSIMs could be created." },
    };

    const { code, msg } = statusMapping[mainOrder.status.toLowerCase()] || statusMapping.failed;

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
    console.error("❌ postOrder error:", err);
    if (mainOrder) {
      mainOrder.status = "failed";
      mainOrder.errorMessage = err.message;
      await orderRepo.save(mainOrder);
    }
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
// Assumes same imports + AppDataSource + entities are available
import axios, { AxiosInstance } from "axios";
import { Transaction } from "../../entity/Transactions.entity";
import { Cart } from "../../entity/Carts.entity";
import { CartItem } from "../../entity/CartItem.entity";
import { Order, ORDER_STATUS, OrderType } from "../../entity/order.entity";
import { Esim } from "../../entity/Esim.entity";
import { User } from "../../entity/User.entity";
import { AppDataSource } from "../../data-source";
import { Response } from "express";
import { sendOrderEmail } from "../../utils/email";

const CONCURRENCY = Number(process.env.ESIM_CONCURRENCY) || 3;
const EXTERNAL_TIMEOUT = 15_000; // ms per external call

// Simple concurrency pool
async function asyncPool<T, R>(poolLimit: number, list: T[], iteratorFn: (item: T) => Promise<R>) {
  const ret: R[] = [];
  const executing: Promise<void>[] = [];
  for (const item of list) {
    const p = (async () => {
      const r = await iteratorFn(item);
      ret.push(r);
    })();
    executing.push(p);
    if (executing.length >= poolLimit) {
      await Promise.race(executing);
      // remove resolved promises
      for (let i = executing.length - 1; i >= 0; i--) {
        if ((executing[i] as any).resolved) executing.splice(i, 1);
      }
    }
  }
  await Promise.all(executing);
  return ret;
}

// Create axios instance with timeout and basic retry-on-401 support
function createAxiosInstance(getToken: () => string | undefined, refreshTokenFn?: () => Promise<string | undefined>): AxiosInstance {
  const instance = axios.create({
    timeout: EXTERNAL_TIMEOUT,
  });

  // Attach bearer header on each request
  instance.interceptors.request.use((cfg:any) => {
    const token = getToken();
    if (token) cfg.headers = { ...(cfg.headers || {}), Authorization: `Bearer ${token}` };
    return cfg;
  });

  // Simple response interceptor to attempt a single token refresh on 401
  instance.interceptors.response.use(
    (resp) => resp,
    async (err) => {
      const originalRequest = err.config;
      if (!originalRequest) throw err;

      // Only try once per request
      if (err.response?.status === 401 && !originalRequest._retry && typeof refreshTokenFn === "function") {
        originalRequest._retry = true;
        try {
          const newToken = await refreshTokenFn();
          if (newToken) {
            // update token provider (if env or store)
            // NOTE: refreshTokenFn should persist token where getToken reads it from
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
            return instance(originalRequest);
          }
        } catch (refreshErr:any) {
          // Continue to throw original 401 if refresh fails
          console.error("Token refresh failed:", refreshErr?.message || refreshErr);
        }
      }
      throw err;
    }
  );

  return instance;
}

/**
 * TODO: implement refreshThirdPartyToken to call your auth endpoint and persist token
 * Example signature:
 * async function refreshThirdPartyToken(): Promise<string | undefined> { ... }
 *
 * getThirdPartyToken() should return current token string (from env, cache or req)
 */

// For this example we'll read token from a simple in-memory holder (replace with your strategy)
let inMemoryThirdPartyToken = ""; // initialize before use
const getThirdPartyToken = () => inMemoryThirdPartyToken || process.env.TURISM_TOKEN;
async function refreshThirdPartyToken(): Promise<string | undefined> {
  // ======= IMPLEMENT THIS =======
  // Call your provider auth endpoint, persist the token (in memory, redis, or env substitute),
  // return the token for the axios interceptor to retry once.
  // Example (pseudocode):
  //
  // const r = await axios.post(process.env.TURISM_AUTH_URL, { clientId, secret });
  // inMemoryThirdPartyToken = r.data.token;
  // return inMemoryThirdPartyToken;
  //
  // If you can't implement refresh right now, at least re-load from env:
  return process.env.TURISM_TOKEN;
  // =============================
}

const axiosInstance = axios.create({
  timeout: 8000, // 8 sec hard timeout
});

export async function reserveAndPurchaseSim(planId: number) {
  try {
    // 💨 hard timeout + fast fail
    const reserve = await axiosInstance.get(
      `${process.env.TURISM_URL}/v2/sims/reserve?product_plan_id=${planId}`,
      {
        headers: { Authorization: `Bearer ${inMemoryThirdPartyToken}` },
      }
    );

    const reserveId = reserve.data?.data?.id;
    if (!reserveId) throw new Error("Reserve failed: No reserveId");

    const purchase = await axiosInstance.post(
      `${process.env.TURISM_URL}/v2/sims/${reserveId}/purchase`,
      {},
      {
        headers: { Authorization: `Bearer ${inMemoryThirdPartyToken}` },
      }
    );

    return purchase.data?.data;
  } catch (err: any) {
    console.error("reserveAndPurchaseSim failed:", err.message);
    throw new Error(
      `SIM creation failed: ${err.response?.status || ""} ${err.message}`
    );
  }
}

// Main handler (reworked)
export const postOrder = async (req: any, res: Response) => {
  const requestId = `postOrder-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  console.log(`[${requestId}] ▶ ENTER postOrder`, { body: req.body, user: req.user?.id });

  const { transactionId } = req.body;
  const userId = req.user?.id;

  if (!transactionId || !userId) {
    console.log(`[${requestId}] ❌ Missing transactionId or userId`, { transactionId, userId });
    return res.status(400).json({ message: "transactionId and userId are required" });
  }

  // Set in-memory token from request if present (optional)
  if (req.thirdPartyToken) {
    inMemoryThirdPartyToken = req.thirdPartyToken;
  }

  const transactionRepo = AppDataSource.getRepository(Transaction);
  const cartRepo = AppDataSource.getRepository(Cart);
  const cartItemRepo = AppDataSource.getRepository(CartItem);
  const orderRepo = AppDataSource.getRepository(Order);
  const esimRepo = AppDataSource.getRepository(Esim);
  const userRepo = AppDataSource.getRepository(User);

  let mainOrder: Order | null = null;

  try {
    console.log(`[${requestId}] 🔎 Fetching transaction + user`);
    const transaction = await transactionRepo.findOne({
      where: { id: transactionId },
      relations: ["user", "cart", "cart.items", "cart.items.plan", "cart.items.plan.country"],
    });
    const user = await userRepo.findOneBy({ id: userId });

    if (!user || !transaction) throw new Error("User or Transaction not found");
    if (transaction.status !== "SUCCESS") throw new Error(`Invalid transaction status: ${transaction.status}`);

    const latestCart = transaction.cart;
    if (!latestCart || latestCart.isDeleted || latestCart.isCheckedOut || latestCart.isError) {
      throw new Error("No valid cart found for this transaction");
    }

    const validCartItems = latestCart.items.filter((i) => !i.isDeleted);
    if (!validCartItems.length) throw new Error("No valid cart items found");

    // Idempotency check
    const existingOrder = await orderRepo.findOne({
      where: { transaction: { transactionId } },
      relations: ["esims", "user"],
    });
    if (existingOrder) {
      console.log(`[${requestId}] ⚠️ Existing order detected, returning it`);
      return res.status(200).json({ message: "Order already processed", order: existingOrder });
    }

    // Create order record early (so we have an order id to attach esims)
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
    console.log(`[${requestId}] ✅ Order saved`, { orderId: mainOrder.id });

    // Build per-unit tasks for all items (so quantity 3 == 3 tasks)
    type UnitTask = { cartItem: CartItem; plan: any; unitIndex: number };
    const tasks: UnitTask[] = [];
    for (const item of validCartItems) {
      const plan = item.plan;
      const existingEsimsForCartItem = await esimRepo.find({ where: { cartItem: { id: item.id } } });
      if (existingEsimsForCartItem && existingEsimsForCartItem.length > 0) {
        // If already exists, we consider these as already-created and skip
        console.log(`[${requestId}] ⚠️ existing esims for cartItem ${item.id} -> skipping unit creation`);
        continue;
      }
      for (let i = 0; i < item.quantity; i++) tasks.push({ cartItem: item, plan, unitIndex: i });
    }

    console.log(`[${requestId}] ℹ Total units to create:`, tasks.length);

    // Run reserve+purchase with limited concurrency
    const results = await Promise.allSettled(
      tasks.map((t) =>
        (async () => {
          const esimData = await reserveAndPurchaseSim(t.plan.planId);
          return { success: true, task: t, esimData };
        })()
      )
    );

    // Process results: save success ones, create placeholder for failures
    const createdEsims: Esim[] = [];
    const failedUnits: { task: UnitTask; reason: any }[] = [];
    for (const r of results) {
      if (r.status === "fulfilled" && r.value.success) {
        const { task, esimData } = r.value;
        try {
          const plan = task.plan;
          const esimEntity = esimRepo.create({
            externalId: esimData.id?.toString() || null,
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
            endDate: new Date(new Date().setDate(new Date().getDate() + (esimData.validity_days || plan.validityDays || 30))),
            country: plan.country,
            user: transaction.user,
            plans: [plan],
            order: mainOrder,
            cartItem: task.cartItem,
          });
          const saved = await esimRepo.save(esimEntity);
          createdEsims.push(saved);
        } catch (saveErr:any) {
          console.error(`[${requestId}] ❌ Save failed for successful purchase`, saveErr?.message || saveErr);
          failedUnits.push({ task: (r as any).value?.task, reason: saveErr });
        }
      } else {
        // r.status === "rejected" or fulfilled with no success
        const reason = r.status === "rejected" ? r.reason : (r as any).value?.reason;
        const task = (r as any).value?.task;
        if (task) {
          failedUnits.push({ task, reason });
        } else {
          console.error(`[${requestId}] ❌ Unknown failure in tasks`, reason);
        }
      }
    }

    // Save placeholder eSIMs for all failed units
    for (const f of failedUnits) {
      try {
        const plan = f.task.plan;
        const placeholder = esimRepo.create({
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
          cartItem: f.task.cartItem,
        });
        await esimRepo.save(placeholder);
      } catch (saveErr:any) {
        console.error(`[${requestId}] ❌ Failed to save placeholder eSIM`, saveErr?.message || saveErr);
      }
    }

    // Resolve order final status
    const totalEsimsInCart = validCartItems.reduce((acc, it) => acc + it.quantity, 0);
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

    // Attach error message summary if any failures occurred
    if (failedUnits.length > 0) {
      const reasons = failedUnits.map((f, idx) => `Unit ${idx + 1}: ${String(f.reason?.message || f.reason).slice(0, 200)}`);
      mainOrder.errorMessage = (mainOrder.errorMessage || "") + "\n" + reasons.join("\n");
    }

    await orderRepo.save(mainOrder);

    // Mark cart checked out
    latestCart.isCheckedOut = true;
    await cartRepo.save(latestCart);

    // Fire-and-forget email (do NOT await)
    (async () => {
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
        console.log(`[${requestId}] ✅ Order email sent (background)`);
      } catch (emailErr: any) {
        console.error(`[${requestId}] ❌ Background email failed`, emailErr?.message || emailErr);
      }
    })();

    // Build response
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
      error: mainOrder.status !== "completed" ? mainOrder.errorMessage || "Some eSIMs failed to process." : null,
    });
  } catch (err: any) {
    console.error(`[${requestId}] ❌ postOrder error:`, err?.message || err);
    if (mainOrder) {
      try {
        mainOrder.status = "failed";
        mainOrder.errorMessage = err.message || String(err);
        await orderRepo.save(mainOrder);
      } catch (saveErr: any) {
        console.error(`[${requestId}] ❌ Failed to save mainOrder in catch`, saveErr?.message || saveErr);
      }
    }
    return res.status(500).json({ message: "Order failed", error: err.message || String(err) });
  }
};

import { Repository } from "typeorm";
import { AppDataSource } from "../data-source";
import { Esim } from "../entity/Esim.entity";
import { EsimTopUp } from "../entity/EsimTopUp.entity";
import { Order, OrderType } from "../entity/order.entity";
import { TopUpPlan } from "../entity/Topup.entity";
import { Transaction, TransactionStatus } from "../entity/Transactions.entity";
import { User } from "../entity/User.entity";
import { sendAdminOrderNotification, sendTopUpUserNotification } from "./email";
import { sendUserNotification } from "./userNotification";
import { getValidThirdPartyToken } from "../middlewares/tokenTruism.service";
import axios from "axios";


export async function processMobileTopUp({
    id,
    transactionId
}: any) {
    const transactionRepo = AppDataSource.getRepository(Transaction);
    const esimRepo = AppDataSource.getRepository(Esim);
    const orderRepo = AppDataSource.getRepository(Order);
    const esimTopUpRepo = AppDataSource.getRepository(EsimTopUp);

    const transaction = await transactionRepo.findOne({
        where: { id, transactionId },
        relations: ["user", "topupPlan", "esim", "esim.country", "esim.plans"],
    });

    if (!transaction || transaction.source !== "MOBILE") return;

    const { user, topupPlan: topUp, esim } = transaction;
    if (!user || !esim || !esim.plans?.length) return;

    // 1️⃣ Mark transaction success
    transaction.status = TransactionStatus.SUCCESS;
    // transaction.response = JSON.stringify(transaction.response);
    await transactionRepo.save(transaction);

    // 2️⃣ Create / fetch order
    const order = await getOrCreateTopUpOrder(transaction, user, esim);

    // 3️⃣ Call provider
    const providerResult = await callTopUpProvider(esim, topUp);

    if (!topUp) {
        console.warn("⚠️ No top-up plan linked to transaction:", transaction.id);
        return;
    }

    if (!providerResult.success) {
        await handleTopUpFailure(order, transaction, esimTopUpRepo, esim, topUp, providerResult.message);
        await triggerTopUpFailureNotifications(user, order, esim);
        return;
    }


    // 4️⃣ Provider success
    await finalizeTopUpSuccess(order, esim, topUp, esimRepo, esimTopUpRepo);
    await triggerTopUpSuccessNotifications(user, order, esim, topUp);
}

async function callTopUpProvider(esim: any, topUp: any) {
    try {
        const token = await getValidThirdPartyToken();

        const formdata = new FormData();
        formdata.append("product_plan_id", topUp.topupId);
        formdata.append("product_id", esim.plans[0].id);
        formdata.append("iccid", esim.iccid);

        const response = await axios.post(
            `${process.env.TURISM_URL}/v2/sims/${esim.iccid}/topup`,
            formdata,
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "multipart/form-data",
                },
            }
        );

        return { success: response.data?.status === "success", data: response.data };
    } catch (err: any) {
        return { success: false, message: err.message };
    }
}

async function getOrCreateTopUpOrder(
    transaction: Transaction,
    user: User,
    esim: Esim
) {
    const orderRepo = AppDataSource.getRepository(Order);

    let order = await orderRepo.findOne({
        where: { transaction: { id: transaction.id } },
    });

    if (!order) {
        order = orderRepo.create({
            user,
            transaction,
            country: esim.country,
            totalAmount: transaction.amount,
            status: "PENDING",
            activated: false,
            type: OrderType.TOP_UP,
            name: `${user.firstName} ${user.lastName}`.trim(),
            email: user.email,
            phone: user.phone,
        });
        await orderRepo.save(order);
    }

    return order;
}

async function finalizeTopUpSuccess(
    order: Order,
    esim: Esim,
    topUp: TopUpPlan,
    esimRepo: Repository<Esim>,
    esimTopUpRepo: Repository<EsimTopUp>
) {
    order.status = "COMPLETED";
    order.activated = true;

    esim.dataAmount = (esim.dataAmount || 0) + (topUp.dataLimit || 0);
    esim.validityDays = Math.max(esim.validityDays || 0, topUp.validityDays || 0);

    await esimRepo.save(esim);
    await AppDataSource.getRepository(Order).save(order);

    await esimTopUpRepo.save(
        esimTopUpRepo.create({ esim, topup: topUp, order })
    );
}

async function triggerTopUpSuccessNotifications(
    user: User,
    order: Order,
    esim: Esim,
    topUp: TopUpPlan
) {
    await sendUserNotification({
        userId: user.id,
        code: "TOPUP_SUCCESS",
        data: {
            country: esim.country,
            dataAmount: `${topUp.dataLimit || 0}MB`,
            orderId: order.id,
        },
    });

    await sendAdminOrderNotification(order);
    await sendTopUpUserNotification(order);
}

async function triggerTopUpFailureNotifications(
    user: User,
    order: Order,
    esim: Esim
) {
    await sendUserNotification({
        userId: user.id,
        code: "TOPUP_FAILED",
        data: {
            country: esim.country,
            orderId: order.id,
        },
    });
}

async function handleTopUpFailure(
    order: Order,
    transaction: Transaction,
    esimTopUpRepo: Repository<EsimTopUp>,
    esim: Esim,
    topUp: TopUpPlan,
    reason: string
) {
    // 1️⃣ Update order
    order.status = "FAILED";
    order.activated = false;
    await AppDataSource.getRepository(Order).save(order);

    // 2️⃣ Update transaction
    transaction.status = TransactionStatus.FAILED;
    transaction.response = JSON.stringify({ reason });
    await AppDataSource.getRepository(Transaction).save(transaction);

    // 3️⃣ Persist top-up failure record (optional but recommended)
    // const failedTopUp = esimTopUpRepo.create({
    //     esim,
    //     topup: topUp,
    //     order,
    //     status: "FAILED", // if you have status column
    //     failureReason: reason,
    // });

    // await esimTopUpRepo.save(failedTopUp);

    console.error("❌ Top-up failed:", {
        orderId: order.id,
        transactionId: transaction.id,
        reason,
    });
}

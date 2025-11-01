import { Request, Response } from "express";
import { AppDataSource } from "../../data-source";
import { Esim } from "../../entity/Esim.entity";
import { User } from "../../entity/User.entity";
import { checkAdmin } from "../../utils/checkAdmin";
import { EsimTopUp } from "../../entity/EsimTopUp.entity";
import { Order } from "../../entity/order.entity";

/**
 * ✅ 1. Get all eSIMs across all users (Admin)
 * Now pulls user details from the Order entity fields
 */
export const adminUserAllESims = async (req: Request, res: Response) => {
  try {
    const esimRepo = AppDataSource.getRepository(Esim);

    const allEsims = await esimRepo.find({
      relations: ["order", "order.transaction", "order.country"],
      order: { createdAt: "DESC" },
    });

    // ✅ Inject "user" details from order entity (preserve structure)
    const formattedEsims = allEsims.map((esim) => ({
      ...esim,
      user: esim.order
        ? {
            id: null, // no actual user relation here
            firstName: (esim.order.name).split(" ")[0],
            lastName: (esim.order.name).split(" ")[1],
            email: esim.order.email || null,
            phone: esim.order.phone || null,
          }
        : null,
    }));

    return res.status(200).json({
      success: true,
      message: "All eSIMs fetched successfully.",
      data: formattedEsims,
    });
  } catch (error) {
    console.error("Error fetching all eSIMs:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch eSIMs.",
      error: error instanceof Error ? error.message : error,
    });
  }
};


/**
 * ✅ 2. Get all eSIMs for a specific user (by userId)
 */
export const adminUserAllESimById = async (req: Request, res: Response) => {
  // 🧩 Only admin can access
  if (!checkAdmin(req, res)) return res.status(403).json({ message: "Unauthorized" });

  const { id } = req.params; // Now `id` = eSIM ID

  if (!id) {
    return res.status(400).json({
      status: "error",
      message: "eSIM ID is required",
    });
  }

  try {
    const esimRepo = AppDataSource.getRepository(Esim);
    const esimTopupRepo = AppDataSource.getRepository(EsimTopUp);

    // 🧠 1️⃣ Fetch the main eSIM with all relations
    const esim = await esimRepo.findOne({
      where: { id },
      relations: [
        "country",
        "order",
        "order.country",
        "order.transaction",
        "order.transaction.user",
        "order.transaction.charges",
        "topupLinks",
        "topupLinks.topup",
      ],
    });

    if (!esim) {
      return res.status(404).json({
        status: "error",
        message: "eSIM not found",
      });
    }

    // 🧠 2️⃣ If there are linked top-ups, load them
    const topUps =
      esim.topupLinks?.map((link) => link.topup).filter(Boolean) || [];

    // 🧠 3️⃣ Normalize response shape for UI
    const formattedResponse = {
      id: esim.order?.id || null,
      name: esim.order?.name || "",
      orderCode: esim.order?.orderCode || "",
      status: esim.order?.status || "",
      totalAmount: esim.order?.totalAmount || "",
      type: esim.order?.type || "esim",
      createdAt: esim.order?.createdAt || esim.createdAt,
      updatedAt: esim.order?.updatedAt || esim.updatedAt,
      transaction: esim.order?.transaction || null,
      country: esim.country || null,
      email: esim.order?.transaction?.user?.email || null,
      esims: [
        {
          id: esim.id,
          iccid: esim.iccid,
          productName: esim.productName,
          currency: esim.currency,
          price: esim.price,
          dataAmount: esim.dataAmount,
          validityDays: esim.validityDays,
          qrCodeUrl: esim.qrCodeUrl,
          startDate: esim.startDate,
          endDate: esim.endDate,
          createdAt: esim.createdAt,
          updatedAt: esim.updatedAt,
          country: esim.country,
          order: esim.order,
          topUps,
          isActive: esim.isActive,
          statusText: esim.statusText,
        },
      ],
    };

    return res.status(200).json({
      message: "eSIM details fetched successfully",
      status: "success",
      data: formattedResponse,
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

/**
 * ✅ 3. Admin deletes a specific eSIM
 * Behavior: If admin deletes eSIM → user remains untouched.
 * The foreign key (userId) in Esim becomes NULL (via onDelete: "SET NULL").
 */
export const adminDeletingESim = async (req: Request, res: Response) => {
    try {
        const { esimId } = req.params;
        const esimRepo = AppDataSource.getRepository(Esim);

        const esim = await esimRepo.findOne({
            where: { id: esimId },
            relations: ["user"],
        });

        if (!esim) {
            return res.status(404).json({
                success: false,
                message: "eSIM not found.",
            });
        }

        await esimRepo.remove(esim);

        return res.status(200).json({
            success: true,
            message: `eSIM deleted successfully.`,
        });
    } catch (error) {
        console.error("Error deleting eSIM:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to delete eSIM.",
            error: error instanceof Error ? error.message : error,
        });
    }
};

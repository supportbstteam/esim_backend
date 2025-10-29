import express from "express"
// import { getAllOrders } from "../../controllers/admin/adminOrder.controllers";
import {
    getAllOrders,
    getOrderById,
    getOrderByUser,
    updateOrderStatus,
    deleteOrder,
    getAllTopUpOrders,
    getTopUpOrderById,
    getTopUpOrdersByUser,
    updateTopUpOrderStatus,
    deleteTopUpOrder
} from "../../controllers/admin/adminOrder.controllers";

const router = express.Router();

router.get("/", getAllOrders);

// GET single order by ID
router.get("/:id", getOrderById);

// GET all orders for a specific user
router.get("/user/:userId", getOrderByUser);

// PATCH update order (status, activated, errorMessage)
router.patch("/update/:id", updateOrderStatus);

// DELETE order
router.delete("/delete/:id", deleteOrder);


router.get("/top-up", getAllTopUpOrders);
router.get("/top-up/:id", getTopUpOrderById);
router.get("/top-up/:userId", getTopUpOrdersByUser);
router.patch("/top-up/:id", updateTopUpOrderStatus);
router.delete("/top-up/:id", deleteTopUpOrder);

export default router;
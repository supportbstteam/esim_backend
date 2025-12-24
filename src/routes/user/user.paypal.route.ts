import { Router } from "express";
import { capturePaypalOrder, createPaypalOrder } from "../../controllers/paypal.controller";
import { auth } from "../../middlewares/auth.handler";

const router = Router();

router.post("/create-order",auth, createPaypalOrder);
router.post("/capture-order", capturePaypalOrder);

export default router;

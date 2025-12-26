import { Router } from "express";
import { capturePaypalOrder, createPaypalOrder, createPaypalOrderMobile } from "../../controllers/paypal.controller";
import { auth } from "../../middlewares/auth.handler";

const router = Router();

router.post("/create-order",auth, createPaypalOrder);
router.post("/capture-order", capturePaypalOrder);

// mobile paypal
router.post("/create-order-mobile", auth, createPaypalOrderMobile);

export default router;

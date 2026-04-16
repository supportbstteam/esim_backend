import { Router } from "express";
import { capturePaypalOrder, createPaypalOrder, createPaypalOrderMobile } from "../../controllers/paypal.controller";
import { auth } from "../../middlewares/auth.handler";

const router = Router();

router.post("/create-order", auth, createPaypalOrder);
router.post("/capture-order", capturePaypalOrder);

router.get("/paypal/processing", (req, res) => {
  res.send(`
    <html>
      <body style="text-align:center;padding:40px">
        <h3>Processing payment…</h3>
        <p>You can safely return to the app.</p>
      </body>
    </html>
  `);
});

router.get("/paypal/cancel", (req, res) => {
  res.send(`
    <html>
      <body style="text-align:center;padding:40px">
        <h3>Payment cancelled</h3>
        <p>You can return to the app.</p>
      </body>
    </html>
  `);
});


// mobile paypal
router.post("/create-order-mobile", auth, createPaypalOrderMobile);

export default router;

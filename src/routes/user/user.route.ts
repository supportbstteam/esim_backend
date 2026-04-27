import express, { Router } from "express";
import countryRoute from "./userCountry.route";
import topUpPlanRoute from "./userTopupPlan.route";
import esimRoute from "./userEsim.route";
import planRoute from "./userPlans.route";
import useContactRoute from "./userContact.route";
import userQuickies from "./userQuickies.route";
import { auth } from "../../middlewares/auth.handler";
import queryRoute from "./userQuery.routes";
import {
  deleteAccount,
  getUserDetails,
  postCreateUser,
  postForgotPassword,
  postResetPassword,
  postUserLogin,
  postVerifyForgotPasswordOtp,
  postVerifyOtp,
  updateProfile,
} from "../../controllers/user/userAuth.controllers";
import { getSocials } from "../../controllers/Social.Media.controllers";
import {
  getOrderDetailsByUser,
  getOrderListByUser,
  getOrderStatus,
  getUserSimSummary,
  postUserClaimRefund,
} from "../../controllers/user/userEsimControlllers";
import { thirdPartyAuthMiddleware } from "../../middlewares/thirdPartyApi.handler";
import userCartRoute from "./userCart.route";
import userTransactionRoute from "./userTransaction.route";
import esimUsage from "./userESimUsage.route";
import userPaypal from "./user.paypal.route";
import { getAllTestimonials } from "../../controllers/admin/adminTestimonials.controllers";
import { claimRefund } from "../../controllers/refundControllers";
import { initiateMobileTransaction } from "../../controllers/stripe/MobileCartStripe.controllers";
import {
  getTopUpStatus,
  initiateMobileTopUpTransaction,
} from "../../controllers/stripe/MobileTopUpStripe.controllers";
import { postOrder } from "../../controllers/user/userPostSim.controller";
import { generateInvoice } from "../../controllers/user/invoice.controller";
import { registerDevice } from "../../controllers/device.controller";
import {
  registerPushToken,
  removePushToken,
} from "../../controllers/notifications/createPlayerId.controller";
import notificationRoute from "./userNotification.route";
import {
  getAllPages,
  getPage,
} from "../../controllers/pages/getPage.controllers";
import { sendTestNotification } from "../../controllers/notifications/testNotification";
import { getUserDevice } from "../../controllers/user/userDevice.controllers";
import { getUserBrands } from "../../controllers/user/userBrands.controllers";

// uncomment for the live server
import { desktopUpload } from "../../utils/DesktopUploadImage";

const router = Router();

router.post("/devices/register", auth, registerPushToken); // create notification playerId
router.delete("/devices/remove", auth, removePushToken); // remove notification playerId

// Public
router.post("/verify-otp", postCreateUser);
router.post("/signup", postVerifyOtp);
router.post("/login", postUserLogin);
router.get("/details", auth, getUserDetails);

// uncomment for the live server
router.put("/update", auth, desktopUpload.single("image"), updateProfile);

// for the vercel
router.put("/update", auth, updateProfile);

router.delete("/delete", auth, deleteAccount);
router.post("/auth/forget-password", postForgotPassword);
router.post("/auth/verify-password-otp", postVerifyForgotPasswordOtp);
router.post("/auth/temp-reset-password", postResetPassword);

// user device one signal player ID
router.post("/device/register", registerDevice);

router.use("/country", countryRoute);
router.use("/plans", planRoute);

// top up mobile + route (web)
router.post(
  "/transactions/mobile/top-up/stripe/initiate",
  auth,
  initiateMobileTopUpTransaction,
);
router.get("/top-up/status/:transactionId", auth, getTopUpStatus);
router.use("/top-up", auth, topUpPlanRoute);

router.use("/e-sim", auth, esimRoute);
// router.use("/auth", userAuthRoute);

// paypal
router.use("/paypal", userPaypal);

router.get("/devices", getUserDevice);
router.get("/brands", getUserBrands);

router.get("/cms/pages/:page", getPage);
router.get("/cms/pages", getAllPages);

// router.get("/cms2/:page", getPage);

router.use("/cms", useContactRoute);
router.get("/social-media", getSocials);

router.get("/sim/summary", auth, getUserSimSummary);

// ---- quickies -----
router.use("/quick-links", userQuickies);

// ---- quickies -----
// ✅ Mobile routes
router.post(
  "/transactions/mobile/stripe/initiate",
  auth,
  initiateMobileTransaction,
);

// router.post("/transactions/orders/status/:transactionId", auth, initiateMobileTransaction);
router.use("/transactions", auth, userTransactionRoute);

// ---- query ------
router.use("/query", queryRoute);

// ---- e sim usage ----
router.use("/usage", esimUsage);
router.use("/notification", auth, notificationRoute);

router.get("/testimonials", getAllTestimonials);

router.post("/test-notification", auth, sendTestNotification);

// -------- order ------------
router.get("/orders/status/:transactionId", auth, getOrderStatus);
router.post("/order", auth, thirdPartyAuthMiddleware, postOrder);
// router.post("/order", auth, generateFakeOrder);
router.get("/order-list", auth, getOrderListByUser);
router.get("/order-details/:orderId", auth, getOrderDetailsByUser);
router.get("/order/invoice/:orderId", generateInvoice);
router.post("/claim", auth, claimRefund);

// --------------------------------------------
router.use("/add-to-cart", auth, userCartRoute);

export default router;

/**
 * If user opt our service and buy one e-sim that auto detect the e-sim validation
 * according to the on going e-sim user must see the top up plans
 * filter the suggestion with the help user where esim is from and provide according to that suggestion
 */

import express from "express";
import { getUserDetails, postCreateUser, postForgotPassword, postResetPassword, postUserLogin, postVerifyForgotPasswordOtp } from "../../controllers/user/userAuth.controllers";

// import { signup, login, getUserDetails } from "../controllers/user.controllers";
// import { authMiddleware } from "../middleware/auth";

const router = express.Router();
router.post("/forget-password", postForgotPassword);
router.post("/verify-password-otp", postVerifyForgotPasswordOtp);
router.post("/temp-reset-password", postResetPassword);

export default router;

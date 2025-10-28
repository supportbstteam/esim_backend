import express from "express";
import { getUserDetails, postCreateUser, postForgotPassword, postResetPassword, postUserLogin, postVerifyForgotPasswordOtp } from "../../controllers/user/userAuth.controllers";

// import { signup, login, getUserDetails } from "../controllers/user.controllers";
// import { authMiddleware } from "../middleware/auth";

const router = express.Router();

// Public
router.post("/signup", postCreateUser);
router.post("/login", postUserLogin);
router.post("/forget-password", postForgotPassword);
router.post("/forget-password-otp", postVerifyForgotPasswordOtp);
router.post("/temp-reset-password", postResetPassword);

export default router;

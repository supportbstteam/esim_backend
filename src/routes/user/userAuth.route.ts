import express from "express";
import { getUserDetails, postCreateUser, postUserLogin } from "../../controllers/user/userAuth.controllers";

// import { signup, login, getUserDetails } from "../controllers/user.controllers";
// import { authMiddleware } from "../middleware/auth";

const router = express.Router();

// Public
router.post("/signup", postCreateUser);
router.post("/login", postUserLogin);

export default router;

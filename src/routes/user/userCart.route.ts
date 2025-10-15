import express from "express"
import { addToCart, getUserCart, removeFromCart, updateCartItem } from "../../controllers/user/userCart.controllers";

const router = express.Router();

router.post("/create", addToCart);
router.get("/", getUserCart);
router.put("/update/:cartItemId", updateCartItem);
router.delete("/delete/:cartItemId", removeFromCart);

export default router;
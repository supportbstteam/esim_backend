import express from "express"
import { addToCart, getUserCart, removeFromCart, removeUserPresentCart, updateCartItem, userRemoveCart } from "../../controllers/user/userCart.controllers";
import { thirdPartyAuthMiddleware } from "../../middlewares/thirdPartyApi.handler";

const router = express.Router();

router.post("/create",thirdPartyAuthMiddleware, addToCart);
router.get("/", getUserCart);
router.put("/update/:cartItemId", updateCartItem);
router.delete("/delete/:cartItemId", removeFromCart);
router.delete("/remove", removeFromCart);
router.delete("/remove-cart", removeUserPresentCart);

export default router;
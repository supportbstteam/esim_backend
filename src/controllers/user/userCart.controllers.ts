import { Request, Response } from "express";
import { AppDataSource } from "../../data-source";
import { Cart } from "../../entity/Carts.entity";
import { CartItem } from "../../entity/CartItem.entity";
import { User } from "../../entity/User.entity";
import { Plan } from "../../entity/Plans.entity";

// Add to Cart
export const addToCart = async (req: any, res: Response) => {
    const userId = req.user.id;
    const { plans } = req.body;

    try {
        const cartRepo = AppDataSource.getRepository(Cart);
        const cartItemRepo = AppDataSource.getRepository(CartItem);
        const planRepo = AppDataSource.getRepository(Plan);
        const userRepo = AppDataSource.getRepository(User);

        const user = await userRepo.findOneBy({ id: userId });
        if (!user) return res.status(404).json({ message: "User not found" });

        let cart = await cartRepo.findOne({
            where: { user: { id: userId }, isCheckedOut: false },
            relations: ["items", "items.plan"]
        });

        if (!cart) {
            cart = cartRepo.create({ user, items: [] });
            await cartRepo.save(cart);
        }

        for (const p of plans) {
            // console.log("---- p ----", p);
            const plan = await planRepo.findOneBy({ id: p.planId });
            if (!plan) {
                return res.status(404).json({ message: `Plan with ID ${p.planId} not found` });
            }

            // Ensure quantity is at least 1
            const quantityToAdd = p.quantity && p.quantity > 0 ? p.quantity : 1;

            let item = cart.items.find(i => i.plan.id === plan.id && !i.isDeleted);
            if (item) {
                item.quantity += quantityToAdd;

                // Prevent negative or zero quantity
                if (item.quantity < 1) item.quantity = 1;

                await cartItemRepo.save(item);
            } else {
                const cartItem = cartItemRepo.create({ cart, plan, quantity: quantityToAdd });
                await cartItemRepo.save(cartItem);
                cart.items.push(cartItem);
            }
        }


        await cartRepo.save(cart);

        // 🔹 Reload cart with user and items
        cart = await cartRepo.findOne({
            where: { id: cart.id },
            relations: ["user", "items", "items.plan"]
        });

        // Format response
        const responseCart = {
            id: cart!.id,
            user: { id: cart!.user.id },
            items: cart!.items
                .filter(i => !i.isDeleted)
                .map(i => ({
                    id: i.id,
                    plan: {
                        id: i.plan.id,
                        name: i.plan.name,
                        price: i.plan.price,
                        validityDays: i.plan.validityDays
                    },
                    quantity: i.quantity
                })),
            isCheckedOut: cart!.isCheckedOut
        };

        return res.json({ message: "Plans added to cart", cart: responseCart });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: "Error adding to cart" });
    }
};

// Update Cart Item Quantity
export const updateCartItem = async (req: any, res: Response) => {
    const userId = req.user.id;
    const { cartItemId } = req.params;
    const { quantity } = req.body;

    if (!quantity || quantity < 1) return res.status(400).json({ message: "Quantity must be at least 1" });

    try {
        const cartItemRepo = AppDataSource.getRepository(CartItem);
        const cartItem = await cartItemRepo.findOne({
            where: { id: cartItemId },
            relations: ["cart", "cart.user"] // <--- add cart.user
        });

        // console.log("----- cart item -----", cartItem);

        if (!cartItem) return res.status(404).json({ message: "Cart item not found" });
        if (cartItem.cart.user.id !== userId) {
            return res.status(403).json({ message: "Unauthorized" });
        }
        cartItem.quantity = quantity;
        await cartItemRepo.save(cartItem);

        return res.json({ message: "Cart item updated", cartItem });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: "Error updating cart item" });
    }
};

// Soft Delete Cart Item
export const removeFromCart = async (req: any, res: Response) => {
    const userId = req.user.id;
    const { cartItemId } = req.params;

    try {
        const cartItemRepo = AppDataSource.getRepository(CartItem);
        const cartItem = await cartItemRepo.findOne({
            where: { id: cartItemId },
            relations: ["cart", "cart.user"] // now works
        });

        // console.log("----- cart item ----", cartItem);

        if (!cartItem) return res.status(404).json({ message: "Cart item not found" });

        if (cartItem.cart.user.id !== userId) {
            return res.status(403).json({ message: "Unauthorized" });
        }

        cartItem.isDeleted = true;
        await cartItemRepo.save(cartItem);

        return res.json({ message: "Item removed from cart" });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: "Error removing item" });
    }
};

// Get User Cart
export const getUserCart = async (req: any, res: Response) => {
    const userId = req.user.id;

    try {
        const cartRepo = AppDataSource.getRepository(Cart);
        const cart = await cartRepo.findOne({
            where: { user: { id: userId }, isCheckedOut: false },
            relations: ["items", "items.plan"]
        });

        if (!cart) return res.json({ cart: { items: [] } });

        return res.json({ cart });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: "Error fetching cart" });
    }
};

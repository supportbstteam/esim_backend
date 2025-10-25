import { Request, Response } from "express";
import { AppDataSource } from "../../data-source";
import { Cart } from "../../entity/Carts.entity";
import { CartItem } from "../../entity/CartItem.entity";
import { User } from "../../entity/User.entity";
import { Plan } from "../../entity/Plans.entity";
import { Transaction } from "../../entity/Transactions.entity";

/**
 * Add plans to user's active cart.
 * Creates a new cart if none exists, is deleted, or has an error.
 */
export const addToCart = async (req: any, res: Response) => {
    const userId = req.user?.id;
    const { plans } = req.body;

    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });
    if (!plans || !Array.isArray(plans) || plans.length === 0)
        return res.status(400).json({ success: false, message: "No plans provided" });

    try {
        const cartRepo = AppDataSource.getRepository(Cart);
        const cartItemRepo = AppDataSource.getRepository(CartItem);
        const planRepo = AppDataSource.getRepository(Plan);
        const userRepo = AppDataSource.getRepository(User);
        const transactionRepo = AppDataSource.getRepository(Transaction);

        // Verify user exists
        const user = await userRepo.findOneBy({ id: userId });
        if (!user) return res.status(404).json({ success: false, message: "User not found" });

        // Find active cart
        let cart = await cartRepo.findOne({
            where: { user: { id: userId }, isCheckedOut: false, isDeleted: false },
            relations: ["items", "items.plan", "items.plan.country"],
        });

        // Create new cart if none exists, deleted, or has error
        if (!cart || cart.isDeleted || cart.isError) {
            const newCart = cartRepo.create({ user, items: [], isError: false });
            await cartRepo.save(newCart);
            cart = await cartRepo.findOneOrFail({
                where: { id: newCart.id },
                relations: ["items", "items.plan", "items.plan.country"],
            });
        }

        // Optional: check last successful transaction
        const lastTransaction = await transactionRepo.findOne({
            where: { user: { id: userId }, status: "SUCCESS" },
            relations: ["cart"],
            order: { createdAt: "DESC" },
        });

        if (lastTransaction?.cart?.isCheckedOut) {
            const newCart = cartRepo.create({ user, items: [], isError: false });
            await cartRepo.save(newCart);
            cart = await cartRepo.findOneOrFail({
                where: { id: newCart.id },
                relations: ["items", "items.plan", "items.plan.country"],
            });
        }

        // Add or update cart items
        for (const p of plans) {
            const plan = await planRepo.findOneBy({ id: p.planId, isDeleted: false, isActive: true });
            if (!plan) return res.status(404).json({ success: false, message: `Plan ${p.planId} not found` });

            const quantityToAdd = p.quantity && p.quantity > 0 ? p.quantity : 1;

            // Check for existing active item
            let item = cart.items.find(i => i.plan.id === plan.id && !i.isDeleted);

            if (item) {
                item.quantity += quantityToAdd;
                await cartItemRepo.save(item);
            } else {
                const newItem = cartItemRepo.create({
                    cart,
                    cartId: cart.id,
                    plan,
                    planId: plan.id,
                    quantity: quantityToAdd,
                    isDeleted: false, // explicitly false
                    itemType: "ESIM",
                });
                await cartItemRepo.save(newItem);
            }
        }

        // Reload cart with updated items
        const updatedCart = await cartRepo.findOneOrFail({
            where: { id: cart.id },
            relations: ["user", "items", "items.plan", "items.plan.country"],
        });

        // Prepare response
        const responseCart = {
            id: updatedCart.id,
            user: { id: updatedCart.user.id },
            items: updatedCart.items.filter(i => !i.isDeleted).map(i => ({
                id: i.id,
                plan: {
                    id: i.plan.id,
                    name: i.plan.name,
                    price: i.plan.price,
                    data: i.plan.data,
                    validityDays: i.plan.validityDays,
                    country: { id: i.plan.country.id, name: i.plan.country.name },
                },
                quantity: i.quantity,
            })),
            isCheckedOut: updatedCart.isCheckedOut,
        };

        return res.json({ success: true, message: "Plans added to cart", cart: responseCart });
    } catch (err) {
        console.error("Error adding to cart:", err);
        return res.status(500).json({ success: false, message: "Error adding to cart" });
    }
};



// -------------------- UPDATE CART ITEM --------------------
export const updateCartItem = async (req: any, res: Response) => {
    const userId = req.user.id;
    const { cartItemId } = req.params;
    const { quantity } = req.body;

    if (!quantity || quantity < 1)
        return res.status(400).json({ message: "Quantity must be at least 1" });

    try {
        const cartItemRepo = AppDataSource.getRepository(CartItem);
        const cartItem = await cartItemRepo.findOne({
            where: { id: cartItemId, isDeleted: false },
            relations: ["cart", "cart.user"],
        });

        if (!cartItem) return res.status(404).json({ message: "Cart item not found" });
        if (cartItem.cart.user.id !== userId)
            return res.status(403).json({ message: "Unauthorized" });

        cartItem.quantity = quantity;
        await cartItemRepo.save(cartItem);

        return res.json({ message: "Cart item updated", cartItem });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: "Error updating cart item" });
    }
};

// -------------------- REMOVE CART ITEM (SOFT DELETE) --------------------
export const removeFromCart = async (req: any, res: Response) => {
    const userId = req.user.id;
    const { cartItemId } = req.params;

    try {
        const cartItemRepo = AppDataSource.getRepository(CartItem);
        const cartItem = await cartItemRepo.findOne({
            where: { id: cartItemId },
            relations: ["cart", "cart.user"],
        });

        if (!cartItem) return res.status(404).json({ message: "Cart item not found" });
        if (cartItem.cart.user.id !== userId)
            return res.status(403).json({ message: "Unauthorized" });

        cartItem.isDeleted = true;
        await cartItemRepo.save(cartItem);

        return res.json({ message: "Item removed from cart" });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: "Error removing item" });
    }
};

/**
 * Get the user's active cart.
 */
export const getUserCart = async (req: any, res: Response) => {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    try {
        const cartRepo = AppDataSource.getRepository(Cart);

        const cart = await cartRepo.findOne({
            where: { user: { id: userId }, isCheckedOut: false, isDeleted: false },
            relations: ["items", "items.plan", "items.plan.country"],
        });

        if (!cart) return res.json({ cart: { items: [] } });

        console.log("---------------- tiem in cart ----------------", cart);

        const activeItems = cart.items.filter(i => !i.isDeleted);

        const responseItems = activeItems.map(i => ({
            id: i.id,
            plan: {
                id: i.plan.id,
                name: i.plan.name,
                price: i.plan.price,
                data: i.plan.data,
                validityDays: i.plan.validityDays,
                country: { id: i.plan.country.id, name: i.plan.country.name },
            },
            quantity: i.quantity,
        }));

        return res.json({
            cart: {
                id: cart.id,
                user: { id: userId },
                items: responseItems,
                isCheckedOut: cart.isCheckedOut,
            },
        });
    } catch (err) {
        console.error("Error fetching cart:", err);
        return res.status(500).json({ message: "Error fetching cart" });
    }
};


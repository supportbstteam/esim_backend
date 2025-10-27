import { Request, Response } from "express";
import { AppDataSource } from "../../data-source";
import { Cart } from "../../entity/Carts.entity";
import { CartItem } from "../../entity/CartItem.entity";
import { User } from "../../entity/User.entity";
import { Plan } from "../../entity/Plans.entity";
import { Transaction } from "../../entity/Transactions.entity";

/**
 * Add plans to user's cart
 */
export const addToCart = async (req: any, res: Response) => {
    const userId = req.user?.id;
    const { plans } = req.body;

    if (!userId) return res.status(401).json({ success: false, message: "Please login to add plans to your cart." });
    if (!plans || !Array.isArray(plans) || !plans.length)
        return res.status(400).json({ success: false, message: "No plans selected to add." });

    try {
        const cartRepo = AppDataSource.getRepository(Cart);
        const cartItemRepo = AppDataSource.getRepository(CartItem);
        const planRepo = AppDataSource.getRepository(Plan);
        const userRepo = AppDataSource.getRepository(User);
        const transactionRepo = AppDataSource.getRepository(Transaction);

        const user = await userRepo.findOneBy({ id: userId });
        if (!user) return res.status(404).json({ success: false, message: "User not found." });

        // Find or create active cart
        let cart = await cartRepo.findOne({
            where: { user: { id: userId }, isCheckedOut: false, isDeleted: false, isError: false },
            relations: ["items", "items.plan", "items.plan.country"],
        });

        if (!cart || cart.isDeleted || cart.isError) {
            cart = cartRepo.create({ user, items: [], isError: false });
            await cartRepo.save(cart);
        }

        // Check for last successful transaction to avoid conflicts
        const lastTransaction = await transactionRepo.findOne({
            where: { user: { id: userId }, status: "SUCCESS" },
            relations: ["cart"],
            order: { createdAt: "DESC" },
        });

        if (lastTransaction?.cart?.isCheckedOut) {
            cart = cartRepo.create({ user, items: [], isError: false });
            await cartRepo.save(cart);
        }

        // Add or update cart items
        for (const p of plans) {
            const plan = await planRepo.findOneBy({ id: p.planId, isDeleted: false, isActive: true });
            if (!plan) return res.status(404).json({ success: false, message: `Plan ${p.planId} not found.` });

            const quantityToAdd = p.quantity && p.quantity > 0 ? p.quantity : 1;

            const existingItem = cart.items.find(i => i.plan.id === plan.id && !i.isDeleted);
            if (existingItem) {
                existingItem.quantity += quantityToAdd;
                await cartItemRepo.save(existingItem);

                console.log('============== EXISITNG CART ITEMS ======================');
                console.log(existingItem);
                console.log('====================================');
            } else {
                const newItem = cartItemRepo.create({
                    cart,
                    plan,
                    quantity: quantityToAdd,
                    isDeleted: false,
                    itemType: "ESIM",
                });
                await cartItemRepo.save(newItem);

                console.log('================ NEW CART ITEM ====================');
                console.log(newItem);
                console.log('====================================');
            }
        }

        const updatedCart = await cartRepo.findOneOrFail({
            where: { id: cart.id },
            relations: ["user", "items", "items.plan", "items.plan.country"],
        });

        const responseItems = updatedCart.items.filter(i => !i.isDeleted).map(i => ({
            id: i.id,
            plan: {
                id: i.plan.id,
                name: i.plan.name,
                price: i.plan.price,
                data: i.plan.data,
                validityDays: i.plan.validityDays,
                isDeleted: i?.isDeleted,
                country: { id: i.plan.country.id, name: i.plan.country.name },
            },
            quantity: i.quantity,
        }));

        return res.json({
            success: true,
            message: "Your cart has been updated successfully!",
            cart: { id: updatedCart.id, user: { id: updatedCart.user.id }, items: responseItems, isCheckedOut: updatedCart.isCheckedOut },
        });
    } catch (err) {
        console.error("Error adding to cart:", err);
        return res.status(500).json({ success: false, message: "Oops! Something went wrong while updating your cart." });
    }
};

/**
 * Update a cart item
 */
export const updateCartItem = async (req: any, res: Response) => {
    const userId = req.user?.id;
    const { cartItemId } = req.params;
    const { quantity } = req.body;

    if (!quantity || quantity < 1)
        return res.status(400).json({ success: false, message: "Quantity must be at least 1." });

    try {
        const cartItemRepo = AppDataSource.getRepository(CartItem);
        const cartItem = await cartItemRepo.findOne({
            where: { id: cartItemId, isDeleted: false },
            relations: ["cart", "cart.user"],
        });

        if (!cartItem) return res.status(404).json({ success: false, message: "Cart item not found." });
        if (cartItem.cart.user.id !== userId) return res.status(403).json({ success: false, message: "You are not authorized to update this item." });

        cartItem.quantity = quantity;
        await cartItemRepo.save(cartItem);

        return res.json({ success: true, message: "Cart item updated successfully.", cartItem });
    } catch (err) {
        console.error("Error updating cart item:", err);
        return res.status(500).json({ success: false, message: "Failed to update cart item." });
    }
};

/**
 * Remove cart item (soft delete)
 */
export const removeFromCart = async (req: any, res: Response) => {
    const userId = req.user?.id;
    const { cartItemId } = req.params;

    try {
        const cartItemRepo = AppDataSource.getRepository(CartItem);
        const cartItem = await cartItemRepo.findOne({
            where: { id: cartItemId },
            relations: ["cart", "cart.user"],
        });

        if (!cartItem) return res.status(404).json({ success: false, message: "Cart item not found." });
        if (cartItem.cart.user.id !== userId) return res.status(403).json({ success: false, message: "You are not authorized to remove this item." });

        cartItem.isDeleted = true;
        await cartItemRepo.save(cartItem);

        return res.json({ success: true, message: "Item removed from your cart." });
    } catch (err) {
        console.error("Error removing cart item:", err);
        return res.status(500).json({ success: false, message: "Failed to remove item from cart." });
    }
};

/**
 * Get user's active cart
 */
export const getUserCart = async (req: any, res: Response) => {
    const { id, role } = req?.user || {};

    // ✅ Fix condition: if user not logged in OR not a normal user
    if (!id || role !== "user") {
        return res.status(401).json({
            success: false,
            message: "Unauthorized",
        });
    }

    try {
        const dataSource = AppDataSource;
        const cartRepo = dataSource.getRepository(Cart);

        // ✅ Get latest active cart for user
        const cart = await cartRepo.findOne({
            where: {
                user: { id },
                isDeleted: false,
                isCheckedOut: false,
                isError: false,
            },
            relations: ["items", "items.plan"], // load related entities if needed
            order: {
                createdAt: "DESC", // ✅ latest cart first
            },
        });

        if (!cart) {
            return res.status(404).json({
                success: false,
                message: "No active cart found",
            });
        }

        return res.status(200).json({
            success: true,
            cart,
        });
    } catch (err) {
        console.error("❌ Error in getUserCart:", err);
        return res.status(500).json({
            success: false,
            message: "Server error while fetching user cart",
        });
    }
};
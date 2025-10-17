import { Request, Response } from "express";
import { AppDataSource } from "../../data-source";
import { Cart } from "../../entity/Carts.entity";
import { CartItem } from "../../entity/CartItem.entity";
import { User } from "../../entity/User.entity";
import { Plan } from "../../entity/Plans.entity";
import { Transaction } from "../../entity/Transactions.entity";

// -------------------- ADD TO CART --------------------
export const addToCart = async (req: any, res: Response) => {
    const userId = req.user.id;
    const { plans } = req.body;

    try {
        const cartRepo = AppDataSource.getRepository(Cart);
        const cartItemRepo = AppDataSource.getRepository(CartItem);
        const planRepo = AppDataSource.getRepository(Plan);
        const userRepo = AppDataSource.getRepository(User);
        const transactionRepo = AppDataSource.getRepository(Transaction);

        const user = await userRepo.findOneBy({ id: userId });
        if (!user) return res.status(404).json({ message: "User not found" });

        // 🔹 Find active (not deleted) and pending (not checked out) cart
        let cart = await cartRepo.findOne({
            where: { user: { id: userId }, isCheckedOut: false, isDeleted: false },
            relations: ["items", "items.plan"],
        });

        // 🔹 If cart is deleted or not found → create new
        if (!cart || cart.isDeleted) {
            cart = cartRepo.create({ user, items: [] });
            await cartRepo.save(cart);
        }

        // 🔹 Check last successful transaction (for safety)
        const lastTransaction = await transactionRepo.findOne({
            where: { user: { id: userId }, status: "SUCCESS" },
            relations: ["cart"],
            order: { createdAt: "DESC" },
        });

        if (lastTransaction?.cart?.isCheckedOut) {
            cart = cartRepo.create({ user, items: [] });
            await cartRepo.save(cart);
        }

        // 🔹 Add each plan
        for (const p of plans) {
            const plan = await planRepo.findOneBy({ id: p.planId, isDeleted: false, isActive: true });
            if (!plan) return res.status(404).json({ message: `Plan with ID ${p.planId} not found or inactive` });

            const quantityToAdd = p.quantity && p.quantity > 0 ? p.quantity : 1;

            // 🔹 Check for an existing, non-deleted item for this plan
            let item = cart.items.find(i => i.plan.id === plan.id && !i.isDeleted);

            // Case 1: item exists and not deleted → increment quantity
            if (item) {
                item.quantity += quantityToAdd;
                if (item.quantity < 1) item.quantity = 1;
                await cartItemRepo.save(item);
            } else {
                // Case 2: existing item is deleted OR does not exist → create new
                const newItem = cartItemRepo.create({
                    cart,
                    plan,
                    quantity: quantityToAdd,
                    isDeleted: false,
                });
                await cartItemRepo.save(newItem);
                cart.items.push(newItem);
            }
        }

        await cartRepo.save(cart);

        // 🔹 Reload cart with updated relations
        const updatedCart = await cartRepo.findOne({
            where: { id: cart.id, isDeleted: false },
            relations: ["user", "items", "items.plan", "items.plan.country"],
        });

        if (!updatedCart) return res.status(404).json({ message: "Cart not found after update" });

        const responseCart = {
            id: updatedCart.id,
            user: { id: updatedCart.user.id },
            items: updatedCart.items
                .filter(i => !i.isDeleted)
                .map(i => ({
                    id: i.id,
                    plan: {
                        id: i.plan.id,
                        name: i.plan.name,
                        price: i.plan.price,
                        validityDays: i.plan.validityDays,
                        country: { id: i.plan.country.id, name: i.plan.country.name },
                    },
                    quantity: i.quantity,
                })),
            isCheckedOut: updatedCart.isCheckedOut,
        };

        return res.json({ success: true, message: "Plans added to cart", cart: responseCart });
    } catch (err) {
        console.error(err);
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

// -------------------- GET USER CART --------------------
export const getUserCart = async (req: any, res: Response) => {
    const userId = req.user.id;

    try {
        const cartRepo = AppDataSource.getRepository(Cart);
        const cart = await cartRepo.findOne({
            where: { user: { id: userId }, isCheckedOut: false, isDeleted: false },
            relations: ["items", "items.plan", "items.plan.country"],
        });

        if (!cart)
            return res.json({ cart: { items: [] } });

        // Filter deleted items before returning
        const filteredItems = cart.items.filter(i => !i.isDeleted);

        return res.json({
            cart: {
                id: cart.id,
                user: { id: userId },
                items: filteredItems.map(i => ({
                    id: i.id,
                    plan: {
                        id: i.plan.id,
                        name: i.plan.name,
                        price: i.plan.price,
                        data: i.plan?.data,
                        validityDays: i.plan.validityDays,
                        country: { id: i.plan.country.id, name: i.plan.country.name },
                    },
                    quantity: i.quantity,
                })),
                isCheckedOut: cart.isCheckedOut,
            },
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: "Error fetching cart" });
    }
};

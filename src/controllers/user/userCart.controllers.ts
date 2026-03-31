import { Request, Response } from "express";
import { AppDataSource } from "../../data-source";
import { Cart } from "../../entity/Carts.entity";
import { CartItem } from "../../entity/CartItem.entity";
import { User } from "../../entity/User.entity";
import { Plan } from "../../entity/Plans.entity";
import { Transaction } from "../../entity/Transactions.entity";
import { reserveSim } from "../../lib/globalFunction";

/**
 * Add plans to user's cart
 */
// export const addToCart = async (req: any, res: Response) => {
//   const userId = req.user?.id;
//   const { plans } = req.body;

//   if (!userId)
//     return res.status(401).json({
//       success: false,
//       message: "Please login to add plans to your cart.",
//     });
//   if (!plans || !Array.isArray(plans) || !plans.length)
//     return res
//       .status(400)
//       .json({ success: false, message: "No plans selected to add." });

//   try {
//     const cartRepo = AppDataSource.getRepository(Cart);
//     const cartItemRepo = AppDataSource.getRepository(CartItem);
//     const planRepo = AppDataSource.getRepository(Plan);
//     const userRepo = AppDataSource.getRepository(User);

//     // ✅ Ensure user exists (might have been deleted)
//     const user = await userRepo.findOneBy({
//       id: userId,
//       isBlocked: false,
//       isVerified: true,
//       isDeleted: false,
//     });
//     if (!user) {
//       return res.status(404).json({
//         success: false,
//         message: "User not found or has been deleted or disabled.",
//       });
//     }

//     // Find or create active cart
//     let cart = await cartRepo.findOne({
//       where: {
//         user: { id: userId },
//         isCheckedOut: false,
//         isDeleted: false,
//         isError: false,
//       },
//       relations: ["items", "items.plan", "items.plan.country"],
//     });

//     //         reserveSim({
//     //     planId:41,
//     //     token :"2982|s9ldrcjowuZEDrSZ7LBxu19YbYtrMsdudPLLJ8DI06408261"
//     //   })

//     if (!cart || cart.isDeleted || cart.isError || cart.isCheckedOut) {
//       cart = cartRepo.create({
//         user,
//         items: [],
//         isError: false,
//         isCheckedOut: false,
//         isDeleted: false,
//       });
//       await cartRepo.save(cart);
//     }

//     // // console.log("----- new cart required -----", cart);
//     // Add or update cart items
//     for (const p of plans) {
//       const plan = await planRepo.findOneBy({
//         id: p.planId,
//         isDeleted: false,
//         isActive: true,
//       });
//       if (!plan)
//         return res
//           .status(404)
//           .json({ success: false, message: `Plan ${p.planId} not found.` });

//       const isExistingPlanOnThirdParty = await reserveSim({
//         planId: plan?.planId,
//         token: req.thirdPartyToken,
//       });

//       if (isExistingPlanOnThirdParty?.status === "error") {
//         return res.status(400).json({
//           success: false,
//           message:
//             isExistingPlanOnThirdParty?.message ||
//             "No SIMs available for the selected plan. Please try again later.",
//         });
//       }

//       const quantityToAdd = p.quantity && p.quantity > 0 ? p.quantity : 1;

//       const existingItem = cart.items.find(
//         (i) => i.plan.id === plan.id && !i.isDeleted,
//       );

//       if (existingItem) {
//         existingItem.quantity += quantityToAdd;
//         existingItem.thirdPlanId =
//           isExistingPlanOnThirdParty?.reserveId || existingItem.thirdPlanId;
//         await cartItemRepo.save(existingItem);

//         // // console.log('============== EXISITNG CART ITEMS ======================');
//         // // console.log(existingItem);
//         // // console.log('====================================');
//       } else {
//         const newItem = cartItemRepo.create({
//           cart,
//           plan,
//           quantity: quantityToAdd,
//           isDeleted: false,
//           itemType: "ESIM",
//           thirdPlanId: isExistingPlanOnThirdParty?.reserveId || null,
//         });
//         await cartItemRepo.save(newItem);

//         // console.log('================ NEW CART ITEM ====================');
//         // console.log(newItem);
//         // console.log('====================================');
//       }
//     }

//     const updatedCart = await cartRepo.findOneOrFail({
//       where: { id: cart.id },
//       relations: ["user", "items", "items.plan", "items.plan.country"],
//     });

//     const responseItems = updatedCart.items
//       .filter((i) => !i.isDeleted)
//       .map((i) => ({
//         id: i.id,
//         plan: {
//           id: i.plan.id,
//           name: i.plan.name,
//           price: i.plan.price,
//           data: i.plan.data,
//           validityDays: i.plan.validityDays,
//           isDeleted: i?.isDeleted,
//           isUnlimited: i?.plan?.isUnlimited,
//           country: {
//             id: i.plan.country.id,
//             name: i.plan.country.name,
//             currency: i.plan?.country?.currency || "USD",
//             phoneCode: i.plan?.country?.phoneCode,
//             isoCode: i.plan?.country?.isoCode,
//             iso3Code: i.plan?.country?.iso3Code,
//           },
//         },
//         quantity: i.quantity,
//       }));

//     return res.json({
//       success: true,
//       message: "Your cart has been updated successfully!",
//       cart: {
//         id: updatedCart.id,
//         user: { id: user.id },
//         items: responseItems,
//         isCheckedOut: updatedCart.isCheckedOut,
//       },
//     });
//   } catch (err) {
//     console.error("Error adding to cart:", err);
//     return res.status(500).json({
//       success: false,
//       message: "Oops! Something went wrong while updating your cart.",
//     });
//   }
// };

export const addToCart = async (req: any, res: Response) => {
  const { id } = req?.user;
  const { plans } = req.body;

  if (!id)
    return res.status(401).json({ success: false, message: "Unauthorized" });

  if (!plans || !Array.isArray(plans) || !plans.length)
    return res
      .status(400)
      .json({ success: false, message: "No plans selected to add." });

  try {
    const cartRepo = AppDataSource.getRepository(Cart);
    const cartItemRepo = AppDataSource.getRepository(CartItem);
    const planRepo = AppDataSource.getRepository(Plan);
    const userRepo = AppDataSource.getRepository(User);

    // validate user
    const user = await userRepo.findOneBy({
      id,
      isBlocked: false,
      isDeleted: false,
      isVerified: true,
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found or disabled.",
      });
    }

    // get active cart
    let cart = await cartRepo.findOne({
      where: {
        user: { id },
        isCheckedOut: false,
        isDeleted: false,
        isError: false,
      },
      relations: ["items", "items.plan"],
    });

    // create cart if not exists
    if (!cart) {
      cart = cartRepo.create({
        user,
        items: [],
        isCheckedOut: false,
        isDeleted: false,
        isError: false,
      });

      await cartRepo.save(cart);
    }

    const failedPlans: any[] = [];
    const successPlans: any[] = [];

    // process all plans
    for (const p of plans) {
      try {
        const plan = await planRepo.findOneBy({
          id: p.planId,
          isDeleted: false,
          isActive: true,
        });

        // plan?.validityDays

        if (!plan) {
          failedPlans.push({
            planId: p.planId,
            planName: "Unknown",
            reason: "Plan not found",
          });
          continue;
        }
        // console.log("Processing planId:", plan);

        // reserve from third party
        const reserve = await reserveSim({
          planId: plan.planId,
          token: req.thirdPartyToken,
        });

        // console.log("Reserve response for planId", plan.planId, ":", plan?.title);

        if (reserve?.status === "error") {
          failedPlans.push({
            planId: p.planId,
            planName: plan.title
              ? `${plan.title}-${plan.validityDays ?? ""}days`
              : "Unknown",
            reason: reserve?.message || "No SIM available",
          });
          continue;
        }

        const quantityToAdd = p.quantity && p.quantity > 0 ? p.quantity : 1;

        const existingItem = cart.items.find(
          (i) => i.plan.id === plan.id && !i.isDeleted,
        );

        if (existingItem) {
          existingItem.quantity += quantityToAdd;
          existingItem.thirdPlanId =
            reserve?.reserveId || existingItem.thirdPlanId;

          await cartItemRepo.save(existingItem);
        } else {
          const newItem = cartItemRepo.create({
            cart,
            plan,
            quantity: quantityToAdd,
            isDeleted: false,
            itemType: "ESIM",
            thirdPlanId: reserve?.reserveId || null,
          });

          await cartItemRepo.save(newItem);

          // push to in-memory cart for next loop
          cart.items.push(newItem);
        }

        successPlans.push({
          planId: p.planId,
          reserveId: reserve?.reserveId,
        });
      } catch (error) {
        failedPlans.push({
          planId: p.planId,
          reason: "Unexpected error",
        });
      }
    }

    // fetch updated cart once
    const updatedCart = await cartRepo.findOneOrFail({
      where: { id: cart.id },
      relations: ["user", "items", "items.plan", "items.plan.country"],
    });

    const responseItems = updatedCart.items
      .filter((i) => !i.isDeleted)
      .map((i) => ({
        id: i.id,
        plan: {
          id: i.plan.id,
          name: i.plan.name,
          price: i.plan.price,
          data: i.plan.data,
          validityDays: i.plan.validityDays,
          isUnlimited: i.plan.isUnlimited,
          country: {
            id: i.plan.country.id,
            name: i.plan.country.name,
            currency: i.plan.country.currency || "USD",
            phoneCode: i.plan.country.phoneCode,
            isoCode: i.plan.country.isoCode,
            iso3Code: i.plan.country.iso3Code,
          },
        },
        quantity: i.quantity,
      }));

    return res.json({
      success: failedPlans.length === 0,
      message:
        failedPlans.length === 0
          ? "All plans added to cart"
          : "Some plans could not be added",
      addedPlans: successPlans,
      failedPlans,
      cart: {
        id: updatedCart.id,
        user: { id: user.id },
        items: responseItems,
        isCheckedOut: updatedCart.isCheckedOut,
      },
    });
  } catch (err) {
    console.error("Error adding to cart:", err);
    return res.status(500).json({
      success: false,
      message: "Something went wrong while updating cart",
    });
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
    return res
      .status(400)
      .json({ success: false, message: "Quantity must be at least 1." });

  try {
    const cartItemRepo = AppDataSource.getRepository(CartItem);
    const cartItem = await cartItemRepo.findOne({
      where: { id: cartItemId, isDeleted: false },
      relations: ["cart", "cart.user"],
    });
    if (!cartItem)
      return res
        .status(404)
        .json({ success: false, message: "Cart item not found." });
    if (
      cartItem?.cart?.user &&
      cartItem.cart.user.id !== userId &&
      cartItem.cart?.user?.isBlocked &&
      cartItem.cart.user.isDeleted
    )
      return res.status(403).json({
        success: false,
        message: "You are not authorized to update this item.",
      });

    cartItem.quantity = quantity;
    await cartItemRepo.save(cartItem);

    return res.json({
      success: true,
      message: "Cart item updated successfully.",
      cartItem,
    });
  } catch (err) {
    console.error("Error updating cart item:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to update cart item." });
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
    const cartRepo = AppDataSource.getRepository(Cart);

    // --- 1️⃣ Find the cart item with its cart and user ---
    const cartItem = await cartItemRepo.findOne({
      where: { id: cartItemId },
      relations: ["cart", "cart.user"],
    });

    // --- 2️⃣ Validate existence and ownership ---
    if (!cartItem)
      return res
        .status(404)
        .json({ success: false, message: "Cart item not found." });

    if (
      cartItem.cart?.user?.id !== userId &&
      cartItem?.cart?.user?.isBlocked &&
      cartItem?.cart?.user?.isDeleted
    )
      return res
        .status(403)
        .json({ success: false, message: "Unauthorized action." });

    const cart = cartItem?.cart;

    // --- 3️⃣ Remove the cart item ---
    await cartItemRepo.remove(cartItem);

    // --- 4️⃣ Check if the cart is now empty ---
    const remainingItems = await cartItemRepo.count({
      where: { cart: { id: cart?.id } },
    });

    // --- 5️⃣ If no items left, delete the cart itself ---
    if (remainingItems === 0 && cart) {
      await cartRepo.remove(cart);
    }

    // --- 6️⃣ Return success response ---
    return res.json({
      success: true,
      message:
        remainingItems === 0
          ? "Item removed. Cart is now empty and has been deleted."
          : "Item successfully removed from your cart.",
    });
  } catch (err) {
    console.error("Error removing cart item:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to remove item from cart.",
    });
  }
};

/**
 * Get user's active cart
 */
export const getUserCart = async (req: any, res: Response) => {
  const { id, role } = req?.user || {};

  if (!id || role !== "user") {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  try {
    const cartRepo = AppDataSource.getRepository(Cart);

    // ✅ Find the latest active cart
    const latestCart = await cartRepo.findOne({
      where: {
        user: { id, isBlocked: false, isDeleted: false },
        isDeleted: false,
        isCheckedOut: false,
        isError: false,
      },
      relations: ["items", "items.plan", "items.plan.country"],
      order: { createdAt: "DESC" },
    });

    if (!latestCart) {
      return res.status(404).json({
        success: false,
        message: "No active cart found",
      });
    }

    // ✅ Filter out deleted items
    latestCart.items = latestCart.items.filter(
      (item) => item && item.isDeleted === false,
    );

    // If all items were deleted, mark cart as empty
    if (latestCart.items.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Cart is empty (all items deleted)",
        cart: { ...latestCart, items: [] },
      });
    }

    return res.status(200).json({ success: true, cart: latestCart });
  } catch (err) {
    console.error("❌ Error in getUserCart:", err);
    return res.status(500).json({
      success: false,
      message: "Server error while fetching user cart",
    });
  }
};

export const userRemoveCart = async (req: any, res: Response) => {
  const { id, role } = req.user;

  if (!id || role !== "user") {
    return res.status(400).json({
      success: false,
      message: "Unauthorized",
    });
  }
  try {
    const cartRepo = await AppDataSource.getRepository(Cart);
    const userRepo = await AppDataSource.getRepository(User);
    const cartItemRepo = await AppDataSource.getRepository(CartItem);

    const user = await userRepo.findOne({
      where: { id },
    });

    if (!user) {
      return res.status(404).json({
        message: "User not found",
        success: false,
      });
    }

    const cart = await cartRepo.findOne({
      where: {
        user: { id },
      },
      relations: ["user"],
    });

    if (!cart) {
      return res.status(404).json({
        success: false,
        message: "Cart not found",
      });
    }

    // Delete cart (items auto-delete because of CASCADE)
    await cartRepo.remove(cart);

    return res.status(200).json({
      success: true,
      message: "Cart and all items removed successfully",
    });
  } catch (err) {
    console.error("Erorr in the remove to cart", err);
    return res.status(500).json({
      success: false,
      message: "Server while removing the cart",
    });
  }
};

export const removeUserPresentCart = async (req: any, res: Response) => {
  const { id, role } = req.user;
  if (!id) {
    return res.status(400).json({
      status: false,
      message: "Unauthorized",
    });
  }

  try {
    const cartRepo = await AppDataSource.getRepository(Cart);
    const userRepo = await AppDataSource.getRepository(User);

    const user = await userRepo.findOneBy({
      id,
      isBlocked: false,
      isDeleted: false,
      isVerified: true,
    });

    if (!user) {
      return res.status(404).json({
        status: false,
        message: "User not found or disabled",
      });
    }

    const cart = await cartRepo.findOne({
      where: {
        user: { id },
        isDeleted: false,
        isCheckedOut: false,
      },
      order: {
        createdAt: "DESC",
      },
    });

    if (!cart) {
      return res.status(404).json({
        status: false,
        message: "No active cart found to remove",
      });
    }

    await cartRepo.remove(cart);

    return res.status(200).json({
      status: true,
      message: "Active cart removed successfully",
    });
  } catch (err) {
    console.error("Error in removeUserPresentCart", err);
    return res.status(500).json({
      status: false,
      message: "Server error while removing present cart",
    });
  }
};

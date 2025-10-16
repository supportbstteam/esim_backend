import { Router } from "express";
import {
    postAdminCreateUser,
    deleteAdminUser,
    patchAdminToggleBlockUser,
    getAdminAllUsers,
    getAdminUserDetails,
    getFilteredUsers,
    putAdminUpdateUser,
} from "../../controllers/admin/adminUser.contollers";

const router = Router();

// User Management
router.post("/create-user", postAdminCreateUser);              // Create user
router.delete("/:userId/delete", deleteAdminUser);        // Soft delete
router.patch("/:userId/block", patchAdminToggleBlockUser); // Block/Unblock
router.put("/:userId/update", putAdminUpdateUser); // Block/Unblock

// User Queries
router.get("/", getAdminAllUsers);                  // All users (with filters)
router.get("/:userId", getAdminUserDetails);       // User details with stats
router.get("/user/filter", getFilteredUsers);

export default router;

import express from "express";

import {
    postAddDevice,
    getDevices,
    updateDevice,
    deleteDevice,
    hardDeleteDevice,
    toggleDeviceStatus
} from "../../controllers/admin/adminDevice.controllers";

const router = express.Router();

// Create
router.post("/add", postAddDevice);

// Read
router.get("/", getDevices);

// Update
router.put("/:id", updateDevice);

// Update
router.patch("/:id/status", toggleDeviceStatus);

// Soft delete
router.delete("/:id", deleteDevice);

// Permanent delete
router.delete("/:id/permanent", hardDeleteDevice);

export default router;

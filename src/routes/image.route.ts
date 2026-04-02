// src/routes/image.routes.ts
import { Router } from "express";
import { deleteAdminImage, getAdminImageById, getAdminImages, updateAdminImage, uploadImageToDesktop } from "../controllers/ImageUploader.controllers";

// uncomment for the live server
import { desktopUpload } from "../utils/DesktopUploadImage";

const router = Router();

// uncomment for the live server
router.post(
    "/upload",
    desktopUpload.single("image"),
    uploadImageToDesktop
);

router.get("/", getAdminImages);
router.get("/:id", getAdminImageById);
router.put("/:id", updateAdminImage);
router.delete("/:id", deleteAdminImage);

export default router;

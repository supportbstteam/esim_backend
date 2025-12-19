// src/routes/image.routes.ts
import { Router } from "express";
import { uploadImageToDesktop } from "../controllers/ImageUploader.controllers";
// import { desktopUpload } from "../utils/DesktopUploadImage";

const router = Router();

// router.post(
//     "/upload",
//     desktopUpload.single("image"),
//     uploadImageToDesktop
// );

export default router;

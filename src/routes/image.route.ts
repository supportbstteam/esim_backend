// // src/routes/image.routes.ts
// import { Router } from "express";
// import { getImages, uploadImageToDesktop } from "../controllers/ImageUploader.controllers";
// import { desktopUpload } from "../utils/DesktopUploadImage";

// const router = Router();

// router.post(
//     "/upload",
//     desktopUpload.single("image"),
//     uploadImageToDesktop
// );

// router.get("/", getImages);
// router.get("/:id", getImages);

// export default router;

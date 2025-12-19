// // src/config/multer.desktop.ts
// import multer from "multer";
// import path from "path";
// import fs from "fs";
// import os from "os";

// // Resolve: ~/Desktop/uploadsimg
// const uploadDir = path.join(
//   os.homedir(),
//   "Desktop",
//   "uploadsimg",
// );

// // Ensure directory exists
// if (!fs.existsSync(uploadDir)) {
//   fs.mkdirSync(uploadDir, { recursive: true });
// }

// export const desktopUpload = multer({
//   storage: multer.diskStorage({
//     destination: (_req, _file, cb) => {
//       cb(null, uploadDir);
//     },
//     filename: (_req, file, cb) => {
//       const uniqueName =
//         Date.now() + "-" + Math.round(Math.random() * 1e9);
//       cb(null, uniqueName + path.extname(file.originalname));
//     },
//   }),
//   limits: {
//     fileSize: 5 * 1024 * 1024, // 5 MB
//   },
//   fileFilter: (_req, file, cb) => {
//     if (!file.mimetype.startsWith("image/")) {
//       cb(new Error("Only image files are allowed"));
//     } else {
//       cb(null, true);
//     }
//   },
// });

// // src/controllers/image.controller.ts
// import { Request, Response } from "express";
// import { AppDataSource } from "../data-source";
// import { Image } from "../entity/Images.entity";

// export const uploadImageToDesktop = async (
//     req: any,
//     res: Response
// ) => {
//     try {
//         if (!req.file) {
//             return res.status(400).json({
//                 message: "No image file received",
//             });
//         }


//         const imageRepo = AppDataSource.getRepository(Image);

//         const image = imageRepo.create({
//             originalName: req.file.originalname,
//             fileName: req.file.filename,
//             mimeType: req.file.mimetype,
//             size: req.file.size,
//             filePath: `/uploadsimg/${req.file.filename}`,
//         });

//         await imageRepo.save(image);

//         return res.status(201).json({
//             message: "Image stored on desktop successfully",
//             data: image,
//         });
//     } catch (err: any) {
//         return res.status(500).json({
//             message: "Image upload failed",
//             error: err.message,
//         });
//     }
// };

// export const getImages = async (req: any, res: Response) => {
//     try {
//         const imageRepo = AppDataSource.getRepository(Image);
//         const images = await imageRepo.find({
//             order: {
//                 createdAt: "DESC"
//             }
//         });

//         return res.status(200).json({
//             message: "Images fetched successfully",
//             data: images
//         })
//     }
//     catch (err: any) {
//         return res.status(500).json({
//             message: "Failed to fetch images",
//             error: err.message
//         })
//     }
// }
// import { Request, Response } from "express";
// import { AppDataSource } from "../../data-source";
// import { Banner } from "../../entity/Banner.entity";
// import { Page } from "../../entity/Page.entity";
// import { Image } from "../../entity/Images.entity";

// const bannerRepo = AppDataSource.getRepository(Banner);
// const pageRepo = AppDataSource.getRepository(Page);
// const imageRepo = AppDataSource.getRepository(Image);

// export class BannerController {

//     // ✅ CREATE Banner
//     static async create(req: Request, res: Response) {
//         try {
//             const { heading, subHeading, pageId, imageIds } = req.body;

//             const page = await pageRepo.findOne({
//                 where: { id: pageId },
//             });

//             if (!page)
//                 return res.status(404).json({
//                     message: "Page not found",
//                 });

//             const images = imageIds?.length
//                 ? await imageRepo.findByIds(imageIds)
//                 : [];

//             const banner = bannerRepo.create({
//                 heading,
//                 subHeading,
//                 page,
//                 images,
//             });

//             await bannerRepo.save(banner);

//             return res.status(201).json({
//                 message: "Banner created",
//                 banner,
//             });

//         } catch (error) {
//             return res.status(500).json({
//                 message: "Error creating banner",
//                 error,
//             });
//         }
//     }


//     // ✅ GET ALL BANNERS
//     static async getAll(req: Request, res: Response) {
//         try {

//             const banners = await bannerRepo.find({
//                 relations: {
//                     page: true,
//                     images: true,
//                 },
//             });

//             return res.json(banners);

//         } catch (error) {
//             return res.status(500).json({
//                 message: "Error fetching banners",
//                 error,
//             });
//         }
//     }


//     // ✅ GET Banner by ID
//     static async getOne(req: Request, res: Response) {
//         try {

//             const { id } = req.params;

//             const banner = await bannerRepo.findOne({
//                 where: { id: Number(id) },
//                 relations: {
//                     page: true,
//                     images: true,
//                 },
//             });

//             if (!banner)
//                 return res.status(404).json({
//                     message: "Banner not found",
//                 });

//             return res.json(banner);

//         } catch (error) {
//             return res.status(500).json({
//                 message: "Error fetching banner",
//                 error,
//             });
//         }
//     }


//     // ✅ UPDATE Banner
//     static async update(req: Request, res: Response) {
//         try {

//             const { id } = req.params;
//             const { heading, subHeading, pageId, imageIds } = req.body;

//             const banner = await bannerRepo.findOne({
//                 where: { id: Number(id) },
//                 relations: {
//                     images: true,
//                     page: true,
//                 },
//             });

//             if (!banner)
//                 return res.status(404).json({
//                     message: "Banner not found",
//                 });

//             if (heading !== undefined)
//                 banner.heading = heading;

//             if (subHeading !== undefined)
//                 banner.subHeading = subHeading;

//             if (pageId) {
//                 const page = await pageRepo.findOne({
//                     where: { id: pageId },
//                 });

//                 if (!page)
//                     return res.status(404).json({
//                         message: "Page not found",
//                     });

//                 banner.page = page;
//             }

//             if (imageIds) {
//                 const images = await imageRepo.findByIds(imageIds);
//                 banner.images = images;
//             }

//             await bannerRepo.save(banner);

//             return res.json({
//                 message: "Banner updated",
//                 banner,
//             });

//         } catch (error) {
//             return res.status(500).json({
//                 message: "Error updating banner",
//                 error,
//             });
//         }
//     }


//     // ✅ DELETE Banner
//     static async delete(req: Request, res: Response) {
//         try {

//             const { id } = req.params;

//             const banner = await bannerRepo.findOne({
//                 where: { id: Number(id) },
//             });

//             if (!banner)
//                 return res.status(404).json({
//                     message: "Banner not found",
//                 });

//             await bannerRepo.remove(banner);

//             return res.json({
//                 message: "Banner deleted successfully",
//             });

//         } catch (error) {
//             return res.status(500).json({
//                 message: "Error deleting banner",
//                 error,
//             });
//         }
//     }

// }

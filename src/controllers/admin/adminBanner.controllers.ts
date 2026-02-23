import { Response } from "express";
import { Banner } from "../../entity/Banner.entity";
import { Page } from "../../entity/Page.entity";
import { checkAdmin } from "../../utils/checkAdmin";
import { getDataSource } from "../../lib/serverless";

export const postCreateBanner = async (req: any, res: Response) => {
    try {
        const dataSource = await getDataSource();

        const bannerRepo = dataSource.getRepository(Banner);
        const pageRepo = dataSource.getRepository(Page);

        // Admin check
        if (!checkAdmin(req, res)) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized"
            });
        }

        const { heading, subHeading, page } = req.body;

        // Validation
        if (!heading && !subHeading) {
            return res.status(400).json({
                success: false,
                message: "Heading or Subheading required"
            });
        }

        if (!page) {
            return res.status(400).json({
                success: false,
                message: "Page is required"
            });
        }

        // Check if page exists
        let existingPage = await pageRepo.findOne({
            where: { page },
            relations: ["banner"]
        });

        // Create new banner instance
        const newBanner = bannerRepo.create({
            heading,
            subHeading
        });

        // Save banner first
        const savedBanner = await bannerRepo.save(newBanner);

        if (existingPage) {
            // Update existing page banner
            existingPage.banner = savedBanner;

            await pageRepo.save(existingPage);

            return res.status(200).json({
                success: true,
                message: "Banner updated successfully",
                data: savedBanner
            });
        } else {
            // Create new page and attach banner
            const newPage = pageRepo.create({
                page,
                banner: savedBanner
            });

            await pageRepo.save(newPage);

            return res.status(201).json({
                success: true,
                message: "Page and Banner created successfully",
                data: savedBanner
            });
        }

    } catch (err) {
        console.error("Error creating banner:", err);

        return res.status(500).json({
            success: false,
            message: "Internal Server Error"
        });
    }
};

export const getBanners = async (req: any, res: Response) => {
    try {
        const dataSource = await getDataSource();
        const pageRepo = dataSource.getRepository(Page);

        const pages = await pageRepo.find({
            relations: ["banner"],
            order: { id: "DESC" }
        });

        const banners = pages
            .filter(p => p.banner)
            .map(p => ({
                page: p.page,
                heading: p.banner.heading,
                subHeading: p.banner.subHeading,
                bannerId: p.banner.id
            }));

        return res.status(200).json({
            success: true,
            count: banners.length,
            data: banners
        });

    } catch (err) {
        console.error("Error fetching banners:", err);

        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};


export const getBannerDetails = async (req: any, res: Response) => {
    try {
        const { page } = req.params;

        const dataSource = await getDataSource();
        const pageRepo = dataSource.getRepository(Page);

        const existingPage = await pageRepo.findOne({
            where: { page },
            relations: ["banner"]
        });

        if (!existingPage || !existingPage.banner) {
            return res.status(404).json({
                success: false,
                message: "Banner not found"
            });
        }

        return res.status(200).json({
            success: true,
            data: {
                page: existingPage.page,
                heading: existingPage.banner.heading,
                subHeading: existingPage.banner.subHeading,
                bannerId: existingPage.banner.id
            }
        });

    } catch (err) {
        console.error("Error fetching banner:", err);

        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};


export const deleteBanner = async (req: any, res: Response) => {
    try {

        if (!checkAdmin(req, res)) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized"
            });
        }

        const { page } = req.params;

        const dataSource = await getDataSource();

        const pageRepo = dataSource.getRepository(Page);
        const bannerRepo = dataSource.getRepository(Banner);

        const existingPage = await pageRepo.findOne({
            where: { page },
            relations: ["banner"]
        });

        if (!existingPage || !existingPage.banner) {
            return res.status(404).json({
                success: false,
                message: "Banner not found"
            });
        }

        const bannerId = existingPage.banner.id;

        // remove relation first
        existingPage.banner = null as any;
        await pageRepo.save(existingPage);

        // delete banner
        await bannerRepo.delete(bannerId);

        return res.status(200).json({
            success: true,
            message: "Banner deleted successfully"
        });

    } catch (err) {
        console.error("Error deleting banner:", err);

        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};
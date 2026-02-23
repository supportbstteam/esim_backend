import { deleteBanner, getBannerDetails, getBanners, postCreateBanner } from "../../controllers/admin/adminBanner.controllers";
import { Banner } from "../../entity/Banner.entity";
import { Image } from "../../entity/Images.entity";
import express from 'express'

const router = express.Router();

router.post("/create", postCreateBanner);

router.get("/", getBanners);

router.get("/:page", getBannerDetails);

router.delete("/delete/:page", deleteBanner);


export default router;
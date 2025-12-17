// src/routes/cms.routes.ts
import { Router } from "express";
import { saveOrUpdatePage } from "../../controllers/pages/updatePage.controllers";
import { getPage,getAllPages } from "../../controllers/pages/getPage.controllers";

const router = Router();

// Create OR Update (idempotent)
router.post("/:page", saveOrUpdatePage);
router.put("/:page", saveOrUpdatePage);
router.get("/:page", getPage);
router.get("/", getAllPages);
export default router;

import { Router } from "express";
import { getAllContent, getContent, saveContent } from "../../controllers/Content.controllers";


const router = Router();

router.get("/:page", getContent);
router.get("/", getAllContent);
router.post("/", saveContent);

export default router;

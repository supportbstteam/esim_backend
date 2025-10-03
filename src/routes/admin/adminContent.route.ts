import { Router } from "express";
import { getContent, saveContent } from "../../controllers/Content.controllers";


const router = Router();

router.get("/:page", getContent);
router.post("/", saveContent);

export default router;

import express from "express"
import { createSocials, deleteSocial, getSocials, updateSocial } from "../../controllers/Social.Media.controllers";

const router = express.Router();

// Social routes
router.get("/", getSocials);
router.post("/create", createSocials); 
router.put("/update/:id", updateSocial);
router.delete("/delete/:id", deleteSocial);

export default router;
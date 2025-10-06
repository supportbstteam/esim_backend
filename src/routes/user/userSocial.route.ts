import express from "express"
import { getSocials } from "../../controllers/Social.Media.controllers";

const router = express.Router();
router.get("/", getSocials);

export default router;
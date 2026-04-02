import { Router } from "express";
import {
  createCountry,
  deleteCountry,
  getCountries,
  getCountryById,
  updateCountry,
  updateCountryStatus,
} from "../../controllers/admin/adminCountry.controllers";

// uncomment for the live server
import { desktopUpload } from "../../utils/DesktopUploadImage";

const router = Router();

router.post("/add-country", createCountry);
router.get("/", getCountries);
router.get("/:id", getCountryById); // Get single country by ID
router.patch("/status/:id", updateCountryStatus); // Update a country
router.delete("/delete/:id", deleteCountry); // Delete a country


// server side update image with the live server
// uncomment for the live server
router.put("/update/:id", desktopUpload.single("image"), updateCountry);

// for the vercel
router.put("/update/:id", updateCountry);

export default router;

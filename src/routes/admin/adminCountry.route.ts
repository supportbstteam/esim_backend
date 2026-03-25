import { Router } from "express";
import {
  createCountry,
  deleteCountry,
  getCountries,
  getCountryById,
  updateCountry,
  updateCountryStatus,
} from "../../controllers/admin/adminCountry.controllers";
import { desktopUpload } from "../../utils/DesktopUploadImage";

const router = Router();

router.post("/add-country", createCountry);
router.get("/", getCountries);
router.get("/:id", getCountryById); // Get single country by ID
router.patch("/status/:id", updateCountryStatus); // Update a country
router.delete("/delete/:id", deleteCountry); // Delete a country

router.put("/update/:id", desktopUpload.single("image"), updateCountry);

export default router;

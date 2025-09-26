import { Router } from "express";
import { createUser, getUsers } from "../../controllers/user/user.controllers";
import { createCountry, deleteCountry, getCountries, getCountryById, updateCountry } from "../../controllers/admin/adminCountry.controllers";

const router = Router();


router.post("/add-country", createCountry);
router.get("/", getCountries);
router.get("/:id", getCountryById);     // Get single country by ID
router.put("/update/:id", updateCountry);      // Update a country
router.delete("/delete/:id", deleteCountry);   // Delete a country

export default router;
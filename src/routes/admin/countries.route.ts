import express from 'express'
import { createCountry, deleteCountry, getCountries, getCountryById, updateCountry } from '../../controllers/country/adminCountry.controllers';

const router = express.Router();

router.post("/add-country", createCountry);
router.get("/", getCountries);
router.get("/:id", getCountryById);     // Get single country by ID
router.put("/update/:id", updateCountry);      // Update a country
router.delete("/delete/:id", deleteCountry);   // Delete a country

export default router;
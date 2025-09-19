import { Request, Response } from "express";
import Country from "../../models/countryModel";
import { checkAdmin } from "../../utils/checkAdmin";

// CREATE (Admin only)
export const createCountry = async (req: Request, res: Response) => {
  if (!(await checkAdmin(req, res))) return;
  try {
    const { name, isoCode, iso3Code, phoneCode, currency, isActive } = req.body;

    const country = new Country({
      name,
      isoCode,
      iso3Code,
      phoneCode,
      currency,
      isActive,
    });

    await country.save();
    res.status(201).json(country);
  } catch (error) {
    res.status(400).json({ message: "Error creating country", error });
  }
};

// READ ALL (Admin only)
export const getCountries = async (req: Request, res: Response) => {
  if (!(await checkAdmin(req, res))) return;
  try {
    const countries = await Country.find();
    res.json(countries);
  } catch (error) {
    res.status(500).json({ message: "Error fetching countries", error });
  }
};

// READ ONE (Admin only)
export const getCountryById = async (req: Request, res: Response) => {
  if (!(await checkAdmin(req, res))) return;
  try {
    const { id } = req.params;
    const country = await Country.findById(id);
    if (!country) return res.status(404).json({ message: "Country not found" });
    res.json(country);
  } catch (error) {
    res.status(500).json({ message: "Error fetching country", error });
  }
};

// UPDATE (Admin only)
export const updateCountry = async (req: Request, res: Response) => {
  if (!(await checkAdmin(req, res))) return;
  try {
    const { id } = req.params;
    const { name, isoCode, iso3Code, phoneCode, currency, isActive } = req.body;

    const country = await Country.findByIdAndUpdate(
      id,
      { name, isoCode, iso3Code, phoneCode, currency, isActive },
      { new: true }
    );

    if (!country) return res.status(404).json({ message: "Country not found" });
    res.json(country);
  } catch (error) {
    res.status(400).json({ message: "Error updating country", error });
  }
};

// SOFT DELETE (Admin only)
export const deleteCountry = async (req: Request, res: Response) => {
  if (!(await checkAdmin(req, res))) return;
  try {
    const { id } = req.params;

    // Update `isDeleted` to true instead of removing
    const country = await Country.findByIdAndUpdate(
      id,
      { isDeleted: true },
      { new: true }
    );

    if (!country) {
      return res.status(404).json({ message: "Country not found" });
    }

    res.json({ message: "Country deleted successfully", country });
  } catch (error) {
    res.status(500).json({ message: "Error deleting country", error });
  }
};


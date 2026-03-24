// src/controllers/CountryController.ts

import { Request, Response } from "express";
import { AppDataSource } from "../../data-source"; // your TypeORM datasource
import { Country } from "../../entity/Country.entity";
import { checkAdmin } from "../../utils/checkAdmin";
import { getDataSource } from "../../lib/serverless"; // singleton DataSource

// CREATE OR REACTIVATE COUNTRY (Admin only)
export const createCountry = async (req: any, res: Response) => {
  if (!(await checkAdmin(req, res))) return;

  const {
    name,
    isoCode,
    iso3Code,
    phoneCode,
    currency,
    isActive,
    description,
    imageUrl,
    metaTitle,
    metaDescription,
    metaKeywords,
  } = req.body;

  if (!name || !isoCode || !phoneCode || !currency) {
    return res
      .status(400)
      .json({ message: "All required fields must be provided" });
  }

  try {
    const dataSource = await getDataSource();
    const countryRepo = dataSource.getRepository(Country);

    // normalize keywords (formdata support)
    let keywords: string[] = [];

    if (metaKeywords) {
      if (Array.isArray(metaKeywords)) {
        keywords = metaKeywords;
      } else if (typeof metaKeywords === "string") {
        try {
          keywords = JSON.parse(metaKeywords);
        } catch {
          keywords = [metaKeywords];
        }
      }
    }

    // check existing
    const existingCountry = await countryRepo.findOne({
      where: [{ name }, { isoCode }],
    });

    if (existingCountry) {
      if (existingCountry.isDelete) {
        // Reactivate
        existingCountry.isDelete = false;
        existingCountry.isActive = isActive ?? true;
        existingCountry.iso3Code = iso3Code ?? existingCountry.iso3Code;
        existingCountry.phoneCode = phoneCode;
        existingCountry.currency = currency;
        existingCountry.description = description;
        existingCountry.imageUrl = imageUrl;

        // SEO
        existingCountry.metaTitle = metaTitle;
        existingCountry.metaDescription = metaDescription;
        existingCountry.metaKeywords = keywords;

        const updated = await countryRepo.save(existingCountry);

        return res.status(200).json({
          message: "Country reactivated",
          country: updated,
        });
      }

      return res.status(400).json({
        message: "Country with same name or ISO code already exists",
      });
    }

    // create new
    const newCountry = countryRepo.create({
      name,
      isoCode,
      iso3Code,
      phoneCode,
      currency,
      description,
      imageUrl,
      isActive: isActive ?? true,

      // SEO
      metaTitle,
      metaDescription,
      metaKeywords: keywords,
    });

    await countryRepo.save(newCountry);

    return res.status(201).json({
      message: "Country created",
      country: newCountry,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Error creating country",
      error,
    });
  }
};

// READ ALL (Admin only)
export const getCountries = async (req: any, res: Response) => {
  if (!(await checkAdmin(req, res))) return;

  try {
    const countryRepo = AppDataSource.getRepository(Country);
    const countries = await countryRepo.find({ where: { isDelete: false } });
    res.json(countries);
  } catch (error) {
    res.status(500).json({ message: "Error fetching countries", error });
  }
};

// READ ONE (Admin only)
export const getCountryById = async (req: any, res: Response) => {
  if (!(await checkAdmin(req, res))) return;

  try {
    const { id } = req.params;
    const countryRepo = AppDataSource.getRepository(Country);

    const country = await countryRepo.findOne({
      where: { id, isDelete: false },
    });

    if (!country) return res.status(404).json({ message: "Country not found" });

    res.json(country);
  } catch (error) {
    res.status(500).json({ message: "Error fetching country", error });
  }
};

export const updateCountry = async (req: any, res: Response) => {
  if (!(await checkAdmin(req, res))) return;

  try {
    const { id } = req.params;

    const {
      name,
      isoCode,
      iso3Code,
      phoneCode,
      currency,
      isActive,
      description,
      metaTitle,
      metaDescription,
      metaKeywords,
    } = req.body;

    const countryRepo = AppDataSource.getRepository(Country);

    const country = await countryRepo.findOne({
      where: { id, isDelete: false },
    });

    if (!country) {
      return res.status(404).json({ message: "Country not found" });
    }

    // normal fields
    country.name = name ?? country.name;
    country.isoCode = isoCode ?? country.isoCode;
    country.iso3Code = iso3Code ?? country.iso3Code;
    country.phoneCode = phoneCode ?? country.phoneCode;
    country.currency = currency ?? country.currency;
    country.isActive = isActive ?? country.isActive;
    country.description = description ?? country.description;

    // SEO fields
    country.metaTitle = metaTitle ?? country.metaTitle;
    country.metaDescription = metaDescription ?? country.metaDescription;
    country.metaKeywords = metaKeywords ?? country.metaKeywords;

    const updatedCountry = await countryRepo.save(country);

    res.json({
      message: "Country updated successfully",
      data: updatedCountry,
    });
  } catch (error) {
    res.status(400).json({
      message: "Error updating country",
      error,
    });
  }
};

// SOFT DELETE (Admin only)
export const deleteCountry = async (req: any, res: Response) => {
  if (!(await checkAdmin(req, res))) return;

  try {
    const { id } = req.params;
    const countryRepo = AppDataSource.getRepository(Country);

    const country = await countryRepo.findOne({
      where: { id, isDelete: false },
    });

    if (!country) {
      return res.status(404).json({ message: "Country not found" });
    }

    country.isDelete = true;
    const updatedCountry = await countryRepo.save(country);

    res.json({
      message: "Country deleted successfully",
      country: updatedCountry,
    });
  } catch (error) {
    res.status(500).json({ message: "Error deleting country", error });
  }
};

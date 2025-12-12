// src/controllers/CountryController.ts

import { Request, Response } from "express";
import { AppDataSource } from "../../data-source"; // your TypeORM datasource
import { Country } from "../../entity/Country.entity";
import { checkAdmin } from "../../utils/checkAdmin";
import { getDataSource } from "../../lib/serverless"; // singleton DataSource


// CREATE OR REACTIVATE COUNTRY (Admin only)
export const createCountry = async (req: any, res: Response) => {

    if (!(await checkAdmin(req, res))) return;

    const { name, isoCode, iso3Code, phoneCode, currency, isActive } = req.body;

    if (!name || !isoCode || !phoneCode || !currency) {
        return res.status(400).json({ message: "All required fields must be provided" });
    }

    try {
        // const countryRepo = AppDataSource.getRepository(Country);
        const dataSource = await getDataSource();
        const adminRecountryRepopo = dataSource.getRepository(Country);


        // Check if a country with the same name or isoCode already exists
        const existingCountry = await adminRecountryRepopo.findOne({
            where: [{ name }, { isoCode }],
        });

        if (existingCountry) {
            if (existingCountry.isDelete) {
                // Reactivate soft-deleted country
                existingCountry.isDelete = false;
                existingCountry.isActive = isActive ?? true;
                existingCountry.iso3Code = iso3Code ?? existingCountry.iso3Code;
                existingCountry.phoneCode = phoneCode;
                existingCountry.currency = currency;

                const updatedCountry = await adminRecountryRepopo.save(existingCountry);
                return res.status(200).json({ message: "Country reactivated", country: updatedCountry });
            } else {
                return res.status(400).json({ message: "Country with same name or ISO code already exists" });
            }
        }

        // Create new country
        const newCountry = adminRecountryRepopo.create({
            name,
            isoCode,
            iso3Code,
            phoneCode,
            currency,
            isActive: isActive ?? true,
        });

        await adminRecountryRepopo.save(newCountry);
        return res.status(201).json({ message: "Country created", country: newCountry });
    } catch (error) {
        return res.status(500).json({ message: "Error creating country", error });
    }
};

// READ ALL (Admin only)
export const getCountries = async (req: Request, res: Response) => {
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
export const getCountryById = async (req: Request, res: Response) => {
    if (!(await checkAdmin(req, res))) return;

    try {
        const { id } = req.params;
        const countryRepo = AppDataSource.getRepository(Country);

        const country = await countryRepo.findOne({ where: { id, isDelete: false } });

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
        const { name, isoCode, iso3Code, phoneCode, currency, isActive, description } = req.body;

        const countryRepo = AppDataSource.getRepository(Country);
        const country = await countryRepo.findOne({ where: { id, isDelete: false } });

        if (!country) return res.status(404).json({ message: "Country not found" });

        country.name = name ?? country.name;
        country.isoCode = isoCode ?? country.isoCode;
        country.iso3Code = iso3Code ?? country.iso3Code;
        country.phoneCode = phoneCode ?? country.phoneCode;
        country.currency = currency ?? country.currency;
        country.isActive = isActive ?? country.isActive;
        country.description = description ?? country.description;

        const updatedCountry = await countryRepo.save(country);
        res.json(updatedCountry);
    } catch (error) {
        res.status(400).json({ message: "Error updating country", error });
    }
};

// SOFT DELETE (Admin only)
export const deleteCountry = async (req: Request, res: Response) => {
    if (!(await checkAdmin(req, res))) return;

    try {
        const { id } = req.params;
        const countryRepo = AppDataSource.getRepository(Country);

        const country = await countryRepo.findOne({ where: { id, isDelete: false } });

        if (!country) {
            return res.status(404).json({ message: "Country not found" });
        }

        country.isDelete = true;
        const updatedCountry = await countryRepo.save(country);

        res.json({ message: "Country deleted successfully", country: updatedCountry });
    } catch (error) {
        res.status(500).json({ message: "Error deleting country", error });
    }
};

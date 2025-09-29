import express, { Response } from 'express'
import { Country } from '../../entity/Country';
import { AppDataSource } from '../../data-source';

const router = express.Router();

export const getCountryUser = async (_req: Request, res: Response) => {
    try {
        const countryRepository = AppDataSource.getRepository(Country);

        // Fetch all countries that are active and not deleted
        const countries = await countryRepository.find({
            where: { isActive: true, isDelete: false },
            order: { name: "ASC" }, // optional: sort by name
        });

        return res.status(200).json({ success: true, data: countries });
    } catch (err: any) {
        console.error("Error fetching countries:", err);
        return res.status(500).json({ success: false, message: "Server error" });
    }
}

export default router;
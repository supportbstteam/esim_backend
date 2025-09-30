import express, { Response } from 'express'
import { Country } from '../../entity/Country.entity';
import { AppDataSource } from '../../data-source';
import { getCountryUser } from '../../controllers/user/userCountry.controllers';

const router = express.Router();

router.get("/", getCountryUser);

export default router;
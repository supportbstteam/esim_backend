import { Response } from "express";
import { Esim } from "../../entity/Esim.entity";
import { AppDataSource } from "../../data-source";
import { getDataSource } from "../../lib/serverless";

export const getUserDataUsageBySimId = async (req: any, res: Response) => {
    const { esimId } = req.params;
    try {
        const dataSource = await getDataSource();

    }
    catch (err) {
        console.error("Error in the Esim Usage: ", err);
    }
}
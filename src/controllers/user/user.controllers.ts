import { AppDataSource } from "../../data-source";
import { User } from "../../entity/User";


const userRepo = AppDataSource.getRepository(User);

export const getUsers = async (req:any, res:any) => {
    const users = await userRepo.find();
    res.json(users);
};

export const createUser = async (req:any, res:any) => {
    const user = userRepo.create(req.body);
    await userRepo.save(user);
    res.status(201).json(user);
};

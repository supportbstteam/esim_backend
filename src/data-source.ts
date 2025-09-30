// src/data-source.ts
import "reflect-metadata";
import { DataSource } from "typeorm";
import { Admin } from "./entity/Admin.entity";
import { Country } from "./entity/Country.entity";
import { User } from "./entity/User.entity";
import { Charges } from "./entity/Charges.entity";
import { Esim } from "./entity/Esim.entity";
import { Plan } from "./entity/Plans.entity";
import { TopUpPlan } from "./entity/Topup.entity";
import { Order } from "./entity/order.entity";
import { Token } from "./entity/Token.entity";
import { Transaction } from "./entity/Transactions.entity";

export const AppDataSource = new DataSource({
    type: "mysql",
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 3306,
    username: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    synchronize: false,
    logging: false,
    entities: [
        Admin,
        Country,
        User,
        Charges,
        Esim,
        Plan,
        TopUpPlan,
        Order,
        Token,
        Transaction,
    ],
    migrations: [],
    subscribers: [],
});
// first do npm run dev in terminal and then push on github
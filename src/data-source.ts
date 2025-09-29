import "reflect-metadata";
import { DataSource } from "typeorm";
import { Admin } from "./entity/Admin";
import { Country } from "./entity/Country";
import { User } from "./entity/User";
import { Charges } from "./entity/Charges";
import { Esim } from "./entity/Esim";
import { Plan } from "./entity/Plans";
import { TopUpPlan } from "./entity/Topup.entity";
import { Order } from "./entity/order.entity";
import { Token } from "./entity/Token";
import { Transaction } from "./entity/Transactions";

export const AppDataSource = new DataSource({
    type: "mysql",
    host: process.env.DB_HOST || "82.25.113.249",
    port: 3306,
    username: process.env.DB_USER || "u353451574_esim",
    password: process.env.DB_PASS || "D0bqF@n9",
    database: process.env.DB_NAME || "u353451574_esim",
    synchronize: false, // ⚠️ never true in production
    logging: true,
    entities: [Admin, Country, User, Charges, Esim, Plan, TopUpPlan, Order, Token, Transaction ], // include all your entities here
    migrations: [],
    subscribers: [],
});

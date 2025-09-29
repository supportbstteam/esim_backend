import "reflect-metadata";
import { DataSource } from "typeorm";
import { User } from "./entity/User";
import { Admin } from "./entity/Admin";
import { Country } from "./entity/Country";
import { Plan } from "./entity/Plans";
import { Esim } from "./entity/Esim";
import { Transaction } from "./entity/Transactions";
import { Charges } from "./entity/Charges";
import { Order } from "./entity/order.entity";
import { Token } from "./entity/Token";
import { TopUpPlan } from "./entity/Topup.entity";

/**
 * ⚠️ WARNING: This is the main TypeORM DataSource.
 * - Do not set `synchronize: true` in production!
 * - Always backup database before making changes.
 */
export const AppDataSource = new DataSource({
    type: "mysql",
    host: "82.25.113.249",
    port: 3306,
    username: "u353451574_esim",
    password: "D0bqF@n9",
    database: "u353451574_esim",
    synchronize: false, // keep this false only turn this true once require for update the DB
    logging: true,
    entities: [User, Admin, Country, Plan, Esim, Transaction, Charges, Order, Token, TopUpPlan],
    migrations: [],
    subscribers: [],
});
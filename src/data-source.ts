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
import path from "path";
// Detect if running compiled JS (dist/) or dev TS (src/)
const isCompiled = __dirname.includes("dist");

export const AppDataSource = new DataSource({
    type: "mysql",
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 3306,
    username: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    synchronize: false,
    logging: false,
    entities: isCompiled
        ? [path.join(__dirname, "entity", "*.js")] // safer absolute path
        : [Admin, Country, User, Charges, Esim, Plan, TopUpPlan, Order, Token, Transaction], // dev
    migrations: [],
    subscribers: [],
});

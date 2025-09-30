// src/data-source.ts
import "reflect-metadata";
import { DataSource } from "typeorm";
import path from "path";

// 👇 Import all entities explicitly
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

// Detect if running compiled JS (dist/) or dev TS (src/)
const isCompiled = __dirname.includes("dist");

export const AppDataSource = new DataSource({
    type: "mysql",
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 3306,
    username: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    synchronize: false, // keep migrations in prod
    logging: false,

    // ✅ Always safe: explicit + glob fallback
    entities: isCompiled
        ? [
            // cover both .js and .ts in dist
            path.resolve(__dirname, "entity", "*.{js,ts}"),
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
        ]
        : [
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

// 👀 Optional: quick debug after init
AppDataSource.initialize()
    .then(() => {
        console.log("✅ Data Source has been initialized.");
        console.log(
            "📦 Entities loaded:",
            AppDataSource.entityMetadatas.map((e) => e.name)
        );
    })
    .catch((err) => {
        console.error("❌ Error during Data Source initialization:", err);
    });

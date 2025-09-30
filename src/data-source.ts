// src/data-source.ts
import "reflect-metadata";
import { DataSource } from "typeorm";
import { allEntities } from ".";

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
    entities: allEntities,
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

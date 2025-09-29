import "reflect-metadata";
import { DataSource } from "typeorm";

export const AppDataSource = new DataSource({
    type: "mysql",
    host: process.env.DB_HOST || "82.25.113.249",
    port: 3306,
    username: process.env.DB_USER || "u353451574_esim",
    password: process.env.DB_PASS || "D0bqF@n9",
    database: process.env.DB_NAME || "u353451574_esim",
    synchronize: false, // ⚠️ never true in production
    logging: true,
    entities:
        process.env.NODE_ENV === "production"
            ? [__dirname + "/entity/*.js"]  // compiled JS in dist/
            : [__dirname + "/entity/*.ts"], // TS in dev
    migrations:
        process.env.NODE_ENV === "production"
            ? [__dirname + "/migration/*.js"]
            : [__dirname + "/migration/*.ts"],
    subscribers:
        process.env.NODE_ENV === "production"
            ? [__dirname + "/subscriber/*.js"]
            : [__dirname + "/subscriber/*.ts"],
});

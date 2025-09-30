import express from "express";
import morgan from "morgan";
import cors from "cors";
import helmet from "helmet";
import { errorHandler } from "./middlewares/error.handler";
import adminRouter from "./routes/admin/admin.route"
import userRouter from "./routes/user/user.route"
import { auth } from "./middlewares/auth.handler";
import { AppDataSource } from "./data-source";
const app = express();

// ======= Third-party middleware =======
app.use(morgan("dev"));
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const basePath = "/api";

// ======= Custom middleware =======
// app.use(auth);

// ======= Routes =======
app.get("/", (req, res) => {
    res.send("Hello from Node + TypeORM + MySQL!");
});

// ======= Routes =======
app.get("/api", (req, res) => {
    res.send("Hello from Node + TypeORM + MySQL! with our Esim products");
});

// ✅ Debug route to show all loaded entities
app.get("/api/entities", (req, res) => {
    try {
        if (!AppDataSource.isInitialized) {
            return res.status(500).json({ message: "Data Source not initialized yet" });
        }

        const entities = AppDataSource.entityMetadatas.map((e) => ({
            name: e.name,
            tableName: e.tableName,
            columns: e.columns.map((c) => c.propertyName),
        }));

        res.json({
            message: "Loaded entities",
            count: entities.length,
            entities,
        });
    } catch (err: any) {
        console.error("Error fetching entities:", err);
        res.status(500).json({ message: "Failed to get entities", error: err.message });
    }
});


// ====== Admin =======
app.use(`${basePath}/admin`, auth, adminRouter);


// ====== User =======
app.use(`${basePath}/user`, userRouter);

// ======= Error handler =======
app.use(errorHandler);

export default app;

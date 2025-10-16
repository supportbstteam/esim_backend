import express from "express";
import morgan from "morgan";
import cors from "cors";
import helmet from "helmet";
import { errorHandler } from "./middlewares/error.handler";
import adminRouter from "./routes/admin/admin.route";
import userRouter from "./routes/user/user.route";
import { auth } from "./middlewares/auth.handler";
import { AppDataSource } from "./data-source";

const app = express();

// ======= Third-party middleware =======
app.use(morgan("dev"));
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ======= ⚡ Lazy DB Initialization middleware =======
app.use(async (req, res, next) => {
    if (!AppDataSource.isInitialized) {
        await AppDataSource.initialize();
        console.log("📦 Data Source initialized");
    }
    next();
});

// (async () => {
//     await AppDataSource.initialize();
//     await AppDataSource.dropDatabase();
//     console.log("✅ Database dropped successfully!");
//     await AppDataSource.synchronize(); // recreate schema if needed
//     console.log("✅ Schema recreated!");
//     await AppDataSource.destroy();
// })();
// ======= Routes =======
app.get("/", (req, res) => {
    res.send("Hello from Node + TypeORM + MySQL!");
});

app.get("/api", (req, res) => {
    res.send("Hello from Node + TypeORM + MySQL! with our Esim products");
});

// ✅ Debug route to show all loaded entities
app.get("/api/entities", (req, res) => {
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
});



// ====== Admin =======
app.use("/api/admin",auth, adminRouter);

// ====== User =======
app.use("/api/user", userRouter);

// ======= Error handler =======
app.use(errorHandler);

export default app;

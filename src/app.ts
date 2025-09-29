import express from "express";
import morgan from "morgan";
import cors from "cors";
import helmet from "helmet";
import { errorHandler } from "./middlewares/error.handler";
import adminRouter from "./routes/admin/admin.route"
import userRouter from "./routes/user/user.route"
import { auth } from "./middlewares/auth.handler";
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

// ====== Admin =======
app.use(`${basePath}/admin`, auth, adminRouter);


// ====== User =======
app.use(`${basePath}/user`, userRouter);

// ======= Error handler =======
app.use(errorHandler);

export default app;

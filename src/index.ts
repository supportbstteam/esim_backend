import "reflect-metadata"; // MUST be first
import "dotenv/config";
import app from "./app";
import { connectDB } from "./lib/db";
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

const PORT = process.env.PORT || 4000;

export const allEntities = [
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
];

(async () => {
  await connectDB(); // TypeORM initialized before server

  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
  });
})();

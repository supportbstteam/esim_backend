import "reflect-metadata"; // MUST be first
import "dotenv/config";
import app from "./app";
import { connectDB } from "./lib/db";
import { Admin } from "./entity/Admin.entity";
import { Country } from "./entity/Country.entity";
import { User } from "./entity/User.entity";
import { Charges } from "./entity/Charges.entity";
import { Esim } from "./entity/Esim.entity";
import { Plan } from "./entity/Plans.entity";
import { TopUpPlan } from "./entity/Topup.entity";
import { Order } from "./entity/order.entity";
import { Token } from "./entity/Token.entity";
import { Transaction } from "./entity/Transactions.entity";

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

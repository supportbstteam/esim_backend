// src/data-source.ts
import "reflect-metadata";
import { DataSource } from "typeorm";
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
import { Reservation } from "./entity/Reservation.entity";
import { Social } from "./entity/SocialMedia.entity";
import { Contact } from "./entity/ContactUs.entity";
import { Content } from "./entity/Content.entity";
import { Faq } from "./entity/Faq.entity";
import { Query } from "./entity/Query.entity";
import { Notification } from "./entity/Notification.entity";
import { Cart } from "./entity/Carts.entity";
import { CartItem } from "./entity/CartItem.entity";
import { Refund } from "./entity/Refund.entity";
import { Blog } from "./entity/Blogs.entity"
import { Testimonial } from "./entity/Testimonials.entity";
import { EsimTopUp } from "./entity/EsimTopUp.entity";
export const AppDataSource = new DataSource({
    type: "mysql",
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 3306,
    username: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    synchronize: false,
    logging: false,
    entities: [
        Admin,
        Country,
        User,
        Esim,
        Plan,
        TopUpPlan,
        EsimTopUp,
        Refund,
        Token,
        Transaction,
        Charges,
        Order,
        Reservation,
        Testimonial,
        Social,
        Contact,
        Content,
        Faq,
        Query,
        Notification,
        Cart,
        CartItem,
        Blog
    ],
    migrations: [],
    subscribers: [],
});
// first do npm run dev in terminal and then push on github.
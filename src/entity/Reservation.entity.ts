import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    CreateDateColumn,
    UpdateDateColumn,
    JoinColumn
} from "typeorm";
import { User } from "./User.entity";
import { Plan } from "./Plans.entity";
import { Country } from "./Country.entity";
import { Order } from "./order.entity";

@Entity({ name: "reservations" })
export class Reservation {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Column({ type: "varchar", length: 100 })
    reserveId!: string;

    @ManyToOne(() => User)
    @JoinColumn({ name: "userId" })
    user!: User;

    @ManyToOne(() => Plan)
    @JoinColumn({ name: "planId" })
    plan!: Plan;

    @ManyToOne(() => Country)
    @JoinColumn({ name: "countryId" })
    country!: Country;

    @ManyToOne(() => Order, { onDelete: "CASCADE" })
    @JoinColumn({ name: "orderId" })
    order!: Order;


    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;
}

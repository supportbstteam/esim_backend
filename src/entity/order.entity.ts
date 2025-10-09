import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    OneToMany,
    CreateDateColumn,
    UpdateDateColumn,
    JoinColumn
} from "typeorm";
import { User } from "./User.entity";
import { Plan } from "./Plans.entity";
import { Transaction } from "./Transactions.entity";
import { Esim } from "./Esim.entity";
import { Charges } from "./Charges.entity";
import { Country } from "./Country.entity";

@Entity({ name: "orders" })
export class Order {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @ManyToOne(() => User)
    @JoinColumn({ name: "userId" })
    user!: User;

    @ManyToOne(() => Plan)
    @JoinColumn({ name: "planId" })
    plan!: Plan;

    @ManyToOne(() => Esim, { nullable: true })
    @JoinColumn({ name: "esimId" })
    esim?: Esim | null;

    @ManyToOne(() => Country, { nullable: true })
    @JoinColumn({ name: "countryId" })
    country?: Country | null;

    @OneToMany(() => Transaction, (transaction) => transaction.order)
    transactions!: Transaction[];

    @ManyToOne(() => Charges, { nullable: true })
    @JoinColumn({ name: "chargesId" })
    charges?: Charges | null;

    // Use string for decimal to avoid TypeScript type errors
    @Column({ type: "decimal", precision: 10, scale: 2 })
    totalAmount!: string;

    @Column({ type: "varchar", length: 50, default: "pending" })
    status!: string; // pending | completed | failed

    @Column({ type: "boolean", default: false })
    activated!: boolean; // whether eSIM is activated

    @Column({ type: "datetime", nullable: true })
    activationDate?: Date | null;

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;
}

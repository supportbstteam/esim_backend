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

@Entity()
export class Order {
     @PrimaryGeneratedColumn("uuid")
    id!: string;

    @ManyToOne(() => User)
    @JoinColumn({ name: "userId" })
    user !: User;

    @ManyToOne(() => Plan)
    @JoinColumn({ name: "planId" })
    plan !: Plan;

    @ManyToOne(() => Esim)
    @JoinColumn({ name: "esimId" })
    esim !: Esim;

    @ManyToOne(() => Country, { nullable: true })
    @JoinColumn({ name: "countryId" })
    country !: Country;

    @OneToMany(() => Transaction, (transaction) => transaction.order)
    transactions !: Transaction[];

    @ManyToOne(() => Charges, { nullable: true })
    @JoinColumn({ name: "chargesId" })
    charges !: Charges;

    @Column({ type: "decimal", precision: 10, scale: 2 })
    totalAmount !: number;

    @Column({ type: "varchar", length: 50, default: "pending" })
    status !: string; // pending | completed | failed

    @Column({ type: "boolean", default: false })
    activated !: boolean; // whether eSIM is activated

    @Column({ type: "datetime", nullable: true })
    activationDate !: Date;

    @CreateDateColumn()
    createdAt !: Date;

    @UpdateDateColumn()
    updatedAt !: Date;
}

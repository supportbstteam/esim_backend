import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    OneToOne,
    CreateDateColumn,
    UpdateDateColumn,
    JoinColumn
} from "typeorm";
import { Transaction } from "./Transactions.entity";
import { User } from "./User.entity";
import { Plan } from "./Plans.entity";
import { Esim } from "./Esim.entity";
import { Country } from "./Country.entity"; // Import Country entity

@Entity()
export class Order {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @ManyToOne(() => User)
    @JoinColumn({ name: "userId" })
    user!: User;

    @ManyToOne(() => Plan)
    @JoinColumn({ name: "planId" })
    plan!: Plan;

    @ManyToOne(() => Transaction, { nullable: false, onDelete: "CASCADE" })
    @JoinColumn({ name: "transactionId" })
    transaction!: Transaction;

    @OneToOne(() => Esim, { nullable: true })
    @JoinColumn({ name: "esimId" })
    esim?: Esim; // Relation to eSIM, optional

    @ManyToOne(() => Country, { nullable: false })
    @JoinColumn({ name: "countryId" })
    country!: Country; // Add country relation

    @Column({ type: "decimal", precision: 10, scale: 2 })
    totalAmount!: number;

    @Column({ type: "varchar", length: 50 })
    status!: string;

    @Column({ type: "varchar", length: 50 })
    name!: string;

    // Replace with something like:
    @Column({ type: "int", nullable: true })
    productPlanId!: number;

    @Column({ type: "varchar", length: 50 })
    email!: string;

    @Column({ type: "varchar", length: 50 })
    planName!: string;

    @Column({ type: "varchar", length: 50 })
    price!: string;

    @Column({ type: "boolean", default: false })
    activated!: boolean;

    @Column({ type: "text", nullable: true })
    errorMessage?: string;

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;
}

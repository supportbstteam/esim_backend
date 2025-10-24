import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    JoinColumn,
    CreateDateColumn,
    UpdateDateColumn,
} from "typeorm";
import { User } from "./User.entity";
import { Plan } from "./Plans.entity";
import { Transaction } from "./Transactions.entity";

@Entity({ name: "orders" })
export class Order {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    // User reference
    @Column({ type: "uuid", nullable: true })
    userId!: string;

    // Snapshot of user details (for historical purposes)
    @Column({ type: "varchar", length: 255, nullable: true })
    userName?: string;

    @Column({ type: "varchar", length: 255, nullable: true })
    userEmail?: string;

    @Column({ type: "varchar", length: 20, nullable: true })
    userPhone?: string;

    @ManyToOne(() => User, { nullable: true, onDelete: "SET NULL" })
    @JoinColumn({ name: "userId" })
    user?: User;

    // Plan reference
    @ManyToOne(() => Plan, { nullable: true, onDelete: "SET NULL" })
    @JoinColumn({ name: "planId" })
    plan?: Plan;

    // Transaction reference
    @ManyToOne(() => Transaction, { nullable: true, onDelete: "SET NULL" })
    @JoinColumn({ name: "transactionId" })
    transaction?: Transaction;

    @Column({ type: "varchar", length: 50, default: "PLAN" })
    orderType!: "PLAN" | "TOPUP";

    @Column({ type: "varchar", length: 255 })
    orderName!: string;

    @Column({ type: "text", nullable: true })
    aboutOrder?: string;

    @Column({ type: "decimal", precision: 10, scale: 2 })
    baseAmount!: number;

    @Column({ type: "decimal", precision: 10, scale: 2, default: 0 })
    taxes!: number;

    @Column({ type: "decimal", precision: 10, scale: 2, default: 0 })
    charges!: number;

    @Column({ type: "decimal", precision: 10, scale: 2 })
    totalAmount!: number;

    @Column({ type: "varchar", length: 50, default: "PENDING" })
    status!: string;

    @Column({ type: "boolean", default: false })
    activated!: boolean;

    // -------- Plan Snapshot --------
    @Column({ type: "varchar", length: 255, nullable: true })
    planName?: string;

    @Column({ type: "varchar", length: 255, nullable: true })
    planTitle?: string;

    @Column({ type: "int", nullable: true })
    planValidityDays?: number;

    @Column({ type: "decimal", precision: 10, scale: 2, nullable: true })
    planData?: number;

    @Column({ type: "boolean", default: false })
    planIsUnlimited?: boolean;

    @Column({ type: "varchar", length: 10, nullable: true })
    planCurrency?: string;

    // -------- Plan Country Snapshot --------
    @Column({ type: "varchar", length: 255, nullable: true })
    planCountryName?: string;

    @Column({ type: "varchar", length: 10, nullable: true })
    planCountryIsoCode?: string;

    @Column({ type: "varchar", length: 10, nullable: true })
    planCountryPhoneCode?: string;

    // -------- Top-Up Snapshot (if needed) --------
    @Column({ type: "varchar", length: 255, nullable: true })
    topupName?: string;

    @Column({ type: "varchar", length: 255, nullable: true })
    topupTitle?: string;

    @Column({ type: "decimal", precision: 10, scale: 2, nullable: true })
    topupPrice?: number;

    @Column({ type: "int", nullable: true })
    topupDataLimit?: number;

    @Column({ type: "int", nullable: true })
    topupValidityDays?: number;

    @Column({ type: "varchar", length: 10, nullable: true })
    topupCurrency?: string;

    // Error + timestamps
    @Column({ type: "text", nullable: true })
    errorMessage?: string;

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;
}

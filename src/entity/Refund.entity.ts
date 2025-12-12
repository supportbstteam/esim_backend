import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    OneToOne,
    JoinColumn,
} from "typeorm";
import { Order } from "./order.entity";
import { Transaction } from "./Transactions.entity";

@Entity({ name: "refund" })
export class Refund {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @OneToOne(() => Order, { nullable: true })
    @JoinColumn({ name: "order" })
    order?: Order | null;

    @OneToOne(() => Transaction, { nullable: true })
    @JoinColumn({ name: "transaction" })
    transaction?: Transaction | null;

    @Column({ type: "varchar", length: 100 })
    firstName!: string;

    @Column({ type: "varchar", length: 100 })
    userId!: string;

    @Column({ type: "varchar", length: 100 })
    lastName!: string;

    @Column({ type: "varchar", length: 150 })
    email!: string;

    @Column({ type: "varchar", length: 20 })
    phone!: string;

    @Column({ type: "text" })
    message!: string;

    @Column({ type: "varchar", length: 200, nullable: true })
    reason?: string | null;

    @Column({ type: "decimal", precision: 10, scale: 2, nullable: true })
    refundAmount?: number | null;

    @Column({ type: "varchar", length: 50, nullable: true })
    refundMethod?: string | null;

    @Column({ type: "enum", enum: ["pending", "approved", "rejected", "processed"], default: "pending" })
    status!: "pending" | "approved" | "rejected" | "processed";

    @Column({ type: "varchar", length: 100, nullable: true })
    processedBy?: string | null;

    @Column({ type: "timestamp", nullable: true })
    processedAt?: Date | null;

    @Column({ type: "boolean", default: false })
    isDeleted!: boolean;

    @CreateDateColumn({ type: "timestamp" })
    createdAt!: Date;

    @UpdateDateColumn({ type: "timestamp" })
    updatedAt!: Date;
}

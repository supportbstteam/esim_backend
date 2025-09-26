import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    CreateDateColumn,
    UpdateDateColumn,
    JoinColumn
} from "typeorm";
import { Order } from "./order.entity";
import { User } from "./User";
import { Plan } from "./Plans";

@Entity()
export class Transaction {
     @PrimaryGeneratedColumn("uuid")
    id!: string;

    @ManyToOne(() => Order, (order) => order.transactions)
    @JoinColumn({ name: "orderId" })
    order!: Order;

    @ManyToOne(() => User)
    @JoinColumn({ name: "userId" })
    user!: User; // optional but useful for reporting

    @ManyToOne(() => Plan)
    @JoinColumn({ name: "planId" })
    plan!: Plan; // the plan for which this transaction is done

    @Column({ type: "varchar", length: 100 })
    paymentGateway!: string; // e.g., Razorpay, Stripe, PayPal

    @Column({ type: "varchar", length: 100 })
    transactionId!: string; // ID from payment gateway

    @Column({ type: "decimal", precision: 10, scale: 2 })
    amount!: number;

    @Column({ type: "varchar", length: 50 })
    status!: string; // pending | success | failed

    @Column({ type: "text", nullable: true })
    response!: string; // raw response from gateway if needed

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;
}

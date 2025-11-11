import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    OneToMany,
    CreateDateColumn,
    UpdateDateColumn,
    JoinColumn,
} from "typeorm";
import { User } from "./User.entity";
import { Charges } from "./Charges.entity";
import { Cart } from "./Carts.entity";
import { Esim } from "./Esim.entity";
import { TopUpPlan } from "./Topup.entity";

export enum TransactionStatus {
    PENDING = "PENDING",
    SUCCESS = "SUCCESS",
    FAILED = "FAILED",
}

@Entity({ name: "transactions" })
export class Transaction {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    // When a user is deleted, delete all their transactions
    @ManyToOne(() => User, { nullable: true, onDelete: "CASCADE" })
    @JoinColumn({ name: "userId" })
    user!: User | null;

    // When a cart is deleted, delete all linked transactions
    @ManyToOne(() => Cart, { nullable: true, onDelete: "CASCADE" })
    @JoinColumn({ name: "cartId" })
    cart?: Cart;

    // When a top-up plan is deleted, set null (optional)
    @ManyToOne(() => TopUpPlan, { nullable: true, onDelete: "SET NULL" })
    @JoinColumn({ name: "topupPlanId" })
    topupPlan?: TopUpPlan;

    // When an eSIM is deleted, delete all related transactions
    @ManyToOne(() => Esim, { nullable: true, onDelete: "CASCADE" })
    @JoinColumn({ name: "esimId" })
    esim!: Esim;

    @Column({ type: "varchar", length: 100 })
    paymentGateway!: string;

    @Column({ type: "varchar", length: 100, unique: true })
    transactionId!: string;

    @Column({ type: "decimal", precision: 10, scale: 2 })
    amount!: number;

    @Column({ type: "varchar", length: 20, default: TransactionStatus.PENDING })
    status!: string;

    @Column({ type: "text", nullable: true })
    response?: string;

    @OneToMany(() => Charges, (charge) => charge.transaction, { cascade: true })
    charges?: Charges[];

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;
}

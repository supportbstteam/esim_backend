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

export enum TransactionStatus {
    PENDING = "PENDING",
    SUCCESS = "SUCCESS",
    FAILED = "FAILED",
}

@Entity({ name: "transactions" })
export class Transaction {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @ManyToOne(() => User, { nullable: false })
    @JoinColumn({ name: "userId" })
    user!: User;

    @ManyToOne(() => Cart, { nullable: true })
    @JoinColumn({ name: "cartId" })
    cart!: Cart;

    @Column({ type: "varchar", length: 100 })
    paymentGateway!: string;

    @Column({ type: "varchar", length: 100, unique: true })
    transactionId!: string;

    @Column({ type: "decimal", precision: 10, scale: 2 })
    amount!: number;

    @Column({ type: "varchar", length: 20, default: "PENDING" })
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

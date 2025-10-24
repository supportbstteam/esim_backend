import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    OneToMany,
    JoinColumn,
    CreateDateColumn,
    UpdateDateColumn
} from "typeorm";
import { Transaction } from "./Transactions.entity";
import { User } from "./User.entity";
import { Plan } from "./Plans.entity";
import { Esim } from "./Esim.entity";
import { Country } from "./Country.entity";

@Entity({ name: "orders" })
export class Order {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @ManyToOne(() => User)
    @JoinColumn({ name: "userId" })
    user!: User;

    // optional: if main order doesn't need a single plan
    // @ManyToOne(() => Plan)
    // @JoinColumn({ name: "planId" })
    // plan!: Plan;

    @ManyToOne(() => Transaction, { nullable: false, onDelete: "CASCADE" })
    @JoinColumn({ name: "transactionId" })
    transaction!: Transaction;

    @OneToMany(() => Esim, (esim) => esim.order, { cascade: true })
    esims!: Esim[];

    @ManyToOne(() => Country, { nullable: false })
    @JoinColumn({ name: "countryId" })
    country!: Country;

    @Column({ type: "decimal", precision: 10, scale: 2, default: 0 })
    totalAmount!: number;

    @Column({ type: "varchar", length: 50 })
    status!: string;

    @Column({ type: "varchar", length: 50 })
    name!: string;

    @Column({ type: "varchar", length: 50 })
    email!: string;

    @Column({ type: "boolean", default: false })
    activated!: boolean;

    @Column({ type: "text", nullable: true })
    errorMessage?: string;

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;
}

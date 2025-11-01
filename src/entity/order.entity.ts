import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    OneToMany,
    JoinColumn,
    CreateDateColumn,
    UpdateDateColumn,
    BeforeInsert,
    DataSource,
} from "typeorm";
import { Transaction } from "./Transactions.entity";
import { User } from "./User.entity";
import { Esim } from "./Esim.entity";
import { Country } from "./Country.entity";
import { AppDataSource } from "../data-source";

export enum OrderType {
    ESIM = "esim",
    TOP_UP = "top up",
}

@Entity({ name: "orders" })
export class Order {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @ManyToOne(() => User, { nullable: true, onDelete: "SET NULL" })
    @JoinColumn({ name: "userId" })
    user!: User | null;

    @Column({ type: "varchar", length: 20, unique: true, nullable: true })
    orderCode!: string | null;

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

    @Column({
        type: "enum",
        enum: OrderType,
        nullable: true,
        default: OrderType.ESIM,
    })
    type?: OrderType;

    @Column({ type: "varchar", length: 50 })
    email!: string;

    @Column({ type: "varchar", length: 20, nullable: true })
    phone?: string;


    @Column({ type: "boolean", default: false })
    activated!: boolean;

    @Column({ type: "text", nullable: true })
    errorMessage?: string;

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;

    // ⚡ Automatically generate orderCode before insert
    @BeforeInsert()
    async generateOrderCode() {
        if (this.orderCode) return; // skip if already set (e.g. manual inserts)

        const prefix = this.type === OrderType.TOP_UP ? "ETUP" : "ESM";

        // Use current timestamp or a count-based suffix
        // If you want sequential pattern:
        const repo = AppDataSource.getRepository(Order);

        const lastOrder = await repo
            .createQueryBuilder("order")
            .where("order.type = :type", { type: this.type })
            .orderBy("order.createdAt", "DESC")
            .getOne();

        const lastNum = lastOrder?.orderCode
            ? parseInt(lastOrder.orderCode.replace(/\D/g, "")) || 0
            : 0;

        const nextNum = lastNum + 1;
        this.orderCode = `${prefix}${nextNum.toString().padStart(5, "0")}`;
    }
}

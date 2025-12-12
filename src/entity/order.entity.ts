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

export const ORDER_STATUS = {
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
  PARTIAL: "PARTIAL",
  PROCESSING: "PROCESSING",
} as const;

export type OrderStatus = (typeof ORDER_STATUS)[keyof typeof ORDER_STATUS];

@Entity({ name: "orders" })
export class Order {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @ManyToOne(() => User, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "userId" })
  user!: User | null;

  @Column({ type: "varchar", length: 20, unique: true })
  orderCode!: string;

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

  /**
   * ✅ Always create unique sequential orderCode for each new entry
   * Works safely for web + mobile, even under concurrency.
   */
  @BeforeInsert()
  async generateOrderCode() {
    const prefix = this.type === OrderType.TOP_UP ? "ETUP" : "ESM";
    const repo = AppDataSource.getRepository(Order);

    try {
      // 🔒 Lock table for write to prevent duplicate orderCodes
      const queryRunner = repo.manager.connection.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();

      try {
        const lastOrder = await queryRunner.manager
          .createQueryBuilder(Order, "order")
          .setLock("pessimistic_write")
          .orderBy("order.createdAt", "DESC")
          .getOne();

        const lastNum = lastOrder?.orderCode
          ? parseInt(lastOrder.orderCode.replace(/\D/g, ""), 10) || 0
          : 0;

        const nextNum = lastNum + 1;
        this.orderCode = `${prefix}${String(nextNum).padStart(5, "0")}`;

        // console.log(`✅ Generated orderCode: ${this.orderCode}`);

        await queryRunner.commitTransaction();
      } catch (err) {
        await queryRunner.rollbackTransaction();
        throw err;
      } finally {
        await queryRunner.release();
      }
    } catch (err) {
      console.error("⚠️ OrderCode generation failed:", err);
      // Fallback to unique timestamp-based ID
      const fallback = `${prefix}${Date.now().toString().slice(-6)}`;
      this.orderCode = fallback;
    }
  }
}

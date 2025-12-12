import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  ManyToMany,
  JoinTable,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  JoinColumn,
} from "typeorm";
import { User } from "./User.entity";
import { Country } from "./Country.entity";
import { Plan } from "./Plans.entity";
import { CartItem } from "./CartItem.entity";
import { Order } from "./order.entity";
import { EsimTopUp } from "./EsimTopUp.entity"; 

@Entity({ name: "esims" })
export class Esim {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  // 🔹 Country (non-null)
  @ManyToOne(() => Country, { nullable: false })
  country!: Country;

  // 🔹 Optional cart item link
  @ManyToOne(() => CartItem, (cartItem) => cartItem.esims, { nullable: true })
  cartItem?: CartItem | null;

  // 🔹 Optional start and end date
  @Column({ type: "date", nullable: true })
  startDate?: Date | null;

  @Column({ type: "date", nullable: true })
  endDate?: Date | null;

  // 🔹 Active flags
  @Index()
  @Column({ type: "boolean", default: true })
  isActive!: boolean;

  @Column({ type: "boolean", default: false })
  isDeleted!: boolean;

  // 🔹 User
  @ManyToOne(() => User, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "userId" })
  user!: User | null;

  // 🔹 eSIM plans
  @ManyToMany(() => Plan, { nullable: true })
  @JoinTable({
    name: "esim_plans",
    joinColumn: { name: "esim_id", referencedColumnName: "id" },
    inverseJoinColumn: { name: "plan_id", referencedColumnName: "id" },
  })
  plans?: Plan[] | null;

  // 🔹 NEW: one-to-many relation with EsimTopUp (each top-up linked to an order)
  @OneToMany(() => EsimTopUp, (et) => et.esim, { nullable: true })
  topupLinks?: EsimTopUp[] | null;

  // 🔹 Order reference (for main plan purchase)
  @ManyToOne(() => Order, (order) => order.esims, {
    onDelete: "CASCADE",
    onUpdate: "CASCADE",
    nullable: true,
  })
  @JoinColumn({ name: "orderId" })
  order!: Order | null;

  // 🔹 Optional metadata
  @Column({ type: "varchar", nullable: true })
  externalId?: string | null;

  @Column({ type: "varchar", nullable: true })
  iccid?: string | null;

  @Column({ type: "varchar", nullable: true })
  qrCodeUrl?: string | null;

  @Column({ type: "varchar", nullable: true })
  networkStatus?: string | null;

  @Column({ type: "varchar", nullable: true })
  statusText?: string | null;

  @Column({ type: "varchar", nullable: true })
  productName?: string | null;

  @Column({ type: "varchar", nullable: true })
  currency?: string | null;

  @Column({ type: "decimal", precision: 10, scale: 2, nullable: true })
  price?: number | null;

  @Column({ type: "int", nullable: true })
  validityDays?: number | null;

  @Column({ type: "float", nullable: true })
  dataAmount?: number | null;

  @Column({ type: "float", nullable: true })
  callAmount?: number | null;

  @Column({ type: "float", nullable: true })
  smsAmount?: number | null;

  // 🔹 Audit timestamps
  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

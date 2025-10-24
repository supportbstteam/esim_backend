import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
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
import { TopUpPlan } from "./Topup.entity";
import { CartItem } from "./CartItem.entity";
import { Order } from "./order.entity";

@Entity({ name: "esims" })
export class Esim {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @ManyToOne(() => Country, { nullable: false })
  country!: Country;

  @ManyToOne(() => CartItem, (cartItem) => cartItem.esims, { nullable: true })
  cartItem?: CartItem;

  @Column({ type: "date", nullable: true })
  startDate?: Date;

  @Column({ type: "date", nullable: true })
  endDate?: Date;

  @Index()
  @Column({ type: "boolean", default: true })
  isActive!: boolean;

  @Column({ type: "boolean", default: false })
  isDeleted!: boolean;

  @ManyToOne(() => User, { nullable: true })
  user?: User | null;

  @ManyToMany(() => Plan)
  @JoinTable({
    name: "esim_plans",
    joinColumn: { name: "esim_id", referencedColumnName: "id" },
    inverseJoinColumn: { name: "plan_id", referencedColumnName: "id" },
  })
  plans!: Plan[];

  @ManyToMany(() => TopUpPlan)
  @JoinTable({
    name: "esim_topups",
    joinColumn: { name: "esim_id", referencedColumnName: "id" },
    inverseJoinColumn: { name: "topup_id", referencedColumnName: "id" },
  })
  topUps!: TopUpPlan[];

  @ManyToOne(() => Order, (order) => order.esims, { nullable: true })
  @JoinColumn({ name: "orderId" })
  order?: Order;

  @Column({ type: "varchar", nullable: true })
  externalId?: string;

  @Column({ type: "varchar", nullable: true })
  iccid?: string;

  @Column({ type: "varchar", nullable: true })
  qrCodeUrl?: string;

  @Column({ type: "varchar", nullable: true })
  networkStatus?: string;

  @Column({ type: "varchar", nullable: true })
  statusText?: string;

  @Column({ type: "varchar", nullable: true })
  productName?: string;

  @Column({ type: "varchar", nullable: true })
  currency?: string;

  @Column({ type: "decimal", precision: 10, scale: 2, nullable: true })
  price?: number;

  @Column({ type: "int", nullable: true })
  validityDays?: number;

  @Column({ type: "float", nullable: true })
  dataAmount?: number;

  @Column({ type: "float", nullable: true })
  callAmount?: number;

  @Column({ type: "float", nullable: true })
  smsAmount?: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

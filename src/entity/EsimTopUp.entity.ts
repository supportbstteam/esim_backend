import {
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  CreateDateColumn,
  JoinColumn,
} from "typeorm";
import { Esim } from "./Esim.entity";
import { TopUpPlan } from "./Topup.entity";
import { Order } from "./order.entity";

@Entity({ name: "esim_topups" })
export class EsimTopUp {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @ManyToOne(() => Esim, (esim) => esim.topupLinks, {
    onDelete: "CASCADE",
    nullable: true, // ✅ allows temporary missing reference
  })
  @JoinColumn({ name: "esim_id" })
  esim!: Esim | null;

  @ManyToOne(() => TopUpPlan, {
    onDelete: "CASCADE",
    nullable: true, // ✅ allows backward compatibility
  })
  @JoinColumn({ name: "topup_id" })
  topup!: TopUpPlan | null;

  @ManyToOne(() => Order, {
    nullable: true, // ✅ optional link to order
    onDelete: "SET NULL",
  })
  @JoinColumn({ name: "order_id" })
  order!: Order | null;

  @CreateDateColumn()
  createdAt!: Date;
}

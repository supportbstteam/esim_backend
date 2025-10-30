import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  JoinColumn,
} from "typeorm";
import { Country } from "./Country.entity";
import { EsimTopUp } from "./EsimTopUp.entity"; // ✅ add relation to new linking entity

@Entity({ name: "topup_plans" })
export class TopUpPlan {
  @PrimaryGeneratedColumn("uuid")
  id!: string; // internal UUID

  @Column({ type: "int", nullable: true })
  @Index()
  topupId?: number | null; // original ID from JSON (nullable for legacy data)

  @Column({ type: "varchar", length: 255, nullable: true })
  name?: string | null;

  @Column({ type: "varchar", length: 255, nullable: true })
  title?: string | null;

  @Column({ type: "decimal", precision: 10, scale: 2, nullable: true })
  price?: number | null;

  @Column({ type: "int", default: 0, nullable: true })
  dataLimit?: number | null; // GB

  @Column({ type: "int", default: 0, nullable: true })
  validityDays?: number | null;

  @Column({ type: "boolean", default: false, nullable: true })
  isUnlimited?: boolean | null;

  @Column({ type: "varchar", length: 10, default: "USD", nullable: true })
  currency?: string | null;

  // ✅ Country relation
  @ManyToOne(() => Country, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "country_id" })
  country?: Country | null;

  @Column({ type: "boolean", default: false, nullable: true })
  isDeleted?: boolean | null;

  @Column({ type: "boolean", default: true, nullable: true })
  isActive?: boolean | null;

  // ✅ New relation — one TopUpPlan can be used in multiple EsimTopUps
  @OneToMany(() => EsimTopUp, (et) => et.topup, { nullable: true })
  topupLinks?: EsimTopUp[] | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

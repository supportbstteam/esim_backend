// src/entity/TopUpPlan.ts
import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    CreateDateColumn,
    UpdateDateColumn,
    Index,
} from "typeorm";
import { Country } from "./Country.entity";

@Entity({ name: "topup_plans" })
export class TopUpPlan {
    @PrimaryGeneratedColumn("uuid")
    id!: string; // internal UUID

    @Column({ type: "int" })
    @Index()
    topupId!: number; // original ID from JSON

    @Column({ type: "varchar", length: 255 })
    name!: string;

    @Column({ type: "varchar", length: 255 })
    title!: string;

    @Column({ type: "decimal", precision: 10, scale: 2 })
    price!: number;

    @Column({ type: "int", default: 0 })
    dataLimit!: number; // GB

    @Column({ type: "int", default: 0 })
    validityDays!: number;

    @Column({ type: "boolean", default: false })
    isUnlimited!: boolean;

    @Column({ type: "varchar", length: 10, default: "USD" })
    currency!: string;

    @ManyToOne(() => Country, { nullable: false })
    country!: Country;

    @Column({ type: "boolean", default: false })
    isDeleted!: boolean;

    @Column({ type: "boolean", default: true })
    isActive!: boolean;  
    
    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;
}


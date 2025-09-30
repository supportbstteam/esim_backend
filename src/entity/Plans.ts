// src/entity/Plan.ts
import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    CreateDateColumn,
    UpdateDateColumn,
    Index,
} from "typeorm";
import { Country } from "./Country";

@Entity({ name: "plans" })
export class Plan {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Column({ type: "varchar", length: 255 })
    @Index()
    title!: string; // e.g., "Unlimited-1"

    @Column({ type: "varchar", length: 255 })
    @Index()
    name!: string; // e.g., "TUR-UNLIMITED-STANDART-1DAY"

    @Column({ type: "decimal", precision: 10, scale: 2, default: 0 })
    data!: number; // data in GB or 0 for unlimited

    @Column({ type: "decimal", precision: 10, scale: 2, default: 0 })
    call!: number; // call units

    @Column({ type: "decimal", precision: 10, scale: 2, default: 0 })
    sms!: number; // sms units

    @Column({ type: "boolean", default: false })
    isUnlimited!: boolean;

    @Column({ type: "int" })
    validityDays!: number;

    @Column({ type: "decimal", precision: 10, scale: 2 })
    price!: string;

    @Column({ type: "varchar", length: 10 })
    currency!: string;

    @Column({ type: "int" })
    planId!: number; // the original plan id from the API

    @Column({ type: "boolean", default: false })
    isDeleted!: boolean;

    @Column({ type: "boolean", default: true })
    isActive!: boolean;

    // Many-to-one relationship with Country
    @ManyToOne(() => Country, { nullable: false })
    country!: Country;

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;
}

// src/entity/Reservation.ts
import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    CreateDateColumn,
    UpdateDateColumn
} from "typeorm";
import { Country } from "./Country.entity";
import { Plan } from "./Plans.entity";
import { User } from "./User.entity";

@Entity({ name: "reservations" })
export class Reservation {
    @PrimaryGeneratedColumn("uuid")
    id!: string; // Reservation unique id

    @Column({ type: "varchar", length: 100, unique: true })
    reserveId!: string; // external/custom reservation id if you want

    // 🔗 Relation to Plan
    @ManyToOne(() => Plan, { nullable: false })
    plan!: Plan;

    // 🔗 Relation to Country
    @ManyToOne(() => Country, { nullable: false })
    country!: Country;

    // 🔗 Relation to User
    @ManyToOne(() => User, { nullable: false })
    user!: User;

    @Column({ type: "boolean", default: false })
    isDelete!: boolean;

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;
}

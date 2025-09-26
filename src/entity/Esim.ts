// src/entity/Esim.ts
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
} from "typeorm";
import { User } from "./User";
import { Country } from "./Country";
import { Plan } from "./Plans";
import { TopUpPlan } from "./Topup.entity";

/**
 * eSIM entity for MySQL using TypeORM
 */
@Entity({ name: "esims" })
export class Esim {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Column({ type: "varchar", length: 255, unique: true })
    simNumber!: string;

    @ManyToOne(() => Country, { nullable: false })
    country!: Country;

    @Column({ type: "date", nullable: true })
    startDate?: Date;

    @Column({ type: "date", nullable: true })
    endDate?: Date;

    @Index()
    @Column({ type: "boolean", default: true })
    isActive!: boolean;

    @Column({ type: "boolean", default: false })
    isDeleted!: boolean;

    @ManyToOne(() => User, (user) => user.simIds, { nullable: true })
    user?: User | null;

    // Plans assigned to this eSIM
    @ManyToMany(() => Plan)
    @JoinTable({
        name: "esim_plans",
        joinColumn: { name: "esim_id", referencedColumnName: "id" },
        inverseJoinColumn: { name: "plan_id", referencedColumnName: "id" },
    })
    plans!: Plan[];

    // Top-ups purchased by this eSIM
    @ManyToMany(() => TopUpPlan)
    @JoinTable({
        name: "esim_topups",
        joinColumn: { name: "esim_id", referencedColumnName: "id" },
        inverseJoinColumn: { name: "topup_id", referencedColumnName: "id" },
    })
    topUps!: TopUpPlan[];

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;
}

import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    OneToMany,
    CreateDateColumn,
    UpdateDateColumn,
    JoinColumn
} from "typeorm";
import { User } from "./User.entity";
import { Plan } from "./Plans.entity";
import { Charges } from "./Charges.entity";

@Entity()
export class Transaction {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @ManyToOne(() => User)
    @JoinColumn({ name: "userId" })
    user!: User;

    @ManyToOne(() => Plan)
    @JoinColumn({ name: "planId" })
    plan!: Plan;

    @Column({ type: "varchar", length: 100 })
    paymentGateway!: string;

    @Column({ type: "varchar", length: 100 })
    transactionId!: string;

    @Column({ type: "decimal", precision: 10, scale: 2 })
    amount!: number;

    @Column({ type: "varchar", length: 50 })
    status!: string;

    @Column({ type: "text", nullable: true })
    response?: string;

    @OneToMany(() => Charges, (charge) => charge.transaction, { cascade: true })
    charges!: Charges[];

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;
}

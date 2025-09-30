import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    OneToMany
} from "typeorm";
import { Order } from "./order.entity";

@Entity()
export class Charges {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Column({ type: "varchar", length: 100 })
    name!: string; // e.g., "Service Fee", "Activation Fee"

    @Column({ type: "decimal", precision: 10, scale: 2 })
    amount!: number; // fixed amount

    @Column({ type: "boolean", default: true })
    isActive!: boolean; // allow disabling a charge

    @OneToMany(() => Order, (order) => order.charges)
    orders!: Order[];

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;
}

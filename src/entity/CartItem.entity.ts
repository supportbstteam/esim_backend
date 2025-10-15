import { Entity, PrimaryGeneratedColumn, ManyToOne, OneToMany, Column, CreateDateColumn, UpdateDateColumn } from "typeorm";
import { Cart } from "./Carts.entity";
import { Plan } from "./Plans.entity";
import { Esim } from "./Esim.entity";

@Entity({ name: "cart_items" })
export class CartItem {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @ManyToOne(() => Cart, cart => cart.items, { nullable: false })
    cart!: Cart;

    @ManyToOne(() => Plan, { nullable: false })
    plan!: Plan;

    @Column({ type: "boolean", default: false })
    isDeleted!: boolean; // soft delete

    @OneToMany(() => Esim, esim => esim.cartItem, { cascade: true })
    esims!: Esim[]; // These are assigned automatically by system

    @Column({ type: "int", default: 1 })
    quantity!: number; // Number of eSIMs required for this plan

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;
}

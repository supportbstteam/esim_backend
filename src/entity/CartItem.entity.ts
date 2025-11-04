import {
    Entity,
    PrimaryGeneratedColumn,
    ManyToOne,
    OneToMany,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    JoinColumn,
} from "typeorm";
import { Cart } from "./Carts.entity";
import { Plan } from "./Plans.entity";
import { Esim } from "./Esim.entity";
import { TopUpPlan } from "./Topup.entity";

@Entity({ name: "cart_items" })
export class CartItem {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    // ---- Cart ----
    @ManyToOne(() => Cart, (cart) => cart.items, { nullable: true, onDelete: "CASCADE" })
    @JoinColumn({ name: "cartId" })
    cart?: Cart;

    @Column({ type: "uuid", nullable: true })
    cartId?: string;

    // ---- Item Type ----
    @Column({
        type: "enum",
        enum: ["ESIM", "TOPUP"],
        default: "ESIM",
    })
    itemType!: "ESIM" | "TOPUP";

    // ---- Plan (always required) ----
    @ManyToOne(() => Plan, { nullable: false })
    @JoinColumn({ name: "planId" })
    plan!: Plan;

    @Column({ type: "uuid" })
    planId!: string;

    // ---- eSIM (required if TOPUP) ----
    @ManyToOne(() => Esim, { nullable: true })
    @JoinColumn({ name: "esimId" })
    esim?: Esim;

    @Column({ type: "uuid", nullable: true })
    esimId?: string;

    // ---- Topup info (required if TOPUP) ----
    @ManyToOne(() => TopUpPlan, { nullable: true })
    @JoinColumn({ name: "topupId" })
    topup?: TopUpPlan;

    @Column({ type: "uuid", nullable: true })
    topupId?: string;

    // ---- Normal purchase field ----
    @OneToMany(() => Esim, (esim) => esim.cartItem, { cascade: true })
    esims!: Esim[]; // created when buying new plan (itemType = 'ESIM')

    @Column({ type: "int", default: 1 })
    quantity!: number;

    @Column({ type: "boolean", default: false })
    isDeleted!: boolean;

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;
}

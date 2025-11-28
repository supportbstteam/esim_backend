import { Entity, PrimaryGeneratedColumn, ManyToOne, OneToMany, Column, CreateDateColumn, UpdateDateColumn, JoinColumn } from "typeorm";
import { User } from "./User.entity";
import { CartItem } from "./CartItem.entity";

@Entity({ name: "carts" })
export class Cart {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @ManyToOne(() => User, { nullable: true, onDelete: "SET NULL" })
    @JoinColumn({ name: "userId" })
    user!: User | null;


    @Column({ type: "boolean", default: false })
    isDeleted!: boolean; // soft delete

    // When a cart is deleted, also delete its items (DB-level cascade)
    @OneToMany(() => CartItem, (item) => item.cart, {
        cascade: true, // ORM-level cascade
        onDelete: "CASCADE", // DB-level cascade
        orphanedRowAction: "delete", // ensures orphan cleanup
    })
    items!: CartItem[];

    @Column({ type: "decimal", default: 0 })
    itemLength!: number;

    @Column({ type: "boolean", default: false })
    isCheckedOut!: boolean;

    @Column({ type: "boolean", default: false, nullable:true })
    isProcessing!: boolean;

    @Column({ type: "boolean", default: false })
    isError!: boolean;

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;
}

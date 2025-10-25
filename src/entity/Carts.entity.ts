import { Entity, PrimaryGeneratedColumn, ManyToOne, OneToMany, Column, CreateDateColumn, UpdateDateColumn } from "typeorm";
import { User } from "./User.entity";
import { CartItem } from "./CartItem.entity";

@Entity({ name: "carts" })
export class Cart {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @ManyToOne(() => User, user => user.carts, { nullable: false })
    user!: User;

    @Column({ type: "boolean", default: false })
    isDeleted!: boolean; // soft delete

    @OneToMany(() => CartItem, item => item.cart, { cascade: true })
    items!: CartItem[];

    @Column({ type: "boolean", default: false })
    isCheckedOut!: boolean;

    @Column({ type: "boolean", default: false })
    isError!: boolean;

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;
}

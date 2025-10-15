import { Entity, PrimaryGeneratedColumn, ManyToOne, OneToMany, Column, CreateDateColumn, UpdateDateColumn } from "typeorm";
import { User } from "./User.entity";
import { CartItem } from "./CartItem.entity";

@Entity({ name: "carts" })
export class Cart {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @ManyToOne(() => User, user => user.carts, { nullable: false })
    user!: User;

    @OneToMany(() => CartItem, item => item.cart, { cascade: true })
    items!: CartItem[];

    @Column({ type: "boolean", default: false })
    isCheckedOut!: boolean;

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;
}

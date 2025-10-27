// src/entity/User.ts
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from "typeorm";
import { Esim } from "./Esim.entity";
import { Cart } from "./Carts.entity";
@Entity({ name: "users" })
export class User {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Column({ type: "varchar", length: 255 })
    firstName!: string;

    @Column({ type: "varchar", length: 255 })
    lastName!: string;

    // @Column({ type: "date" })
    // dob!: Date;

    @OneToMany(() => Cart, (cart) => cart?.user)
    carts !: Cart[]

    @Column({ type: "varchar", length: 255, unique: true })
    email!: string;

    @Column({ type: "varchar", length: 255 })
    password!: string;

    @OneToMany(() => Esim, (esim: any) => esim.user)
    simIds!: Esim[];

    @Column({ type: "boolean", default: false })
    isBlocked!: boolean;

    @Column({ type: "boolean", default: false })
    isDeleted!: boolean;

    @Column({ type: "varchar", length: 20, nullable: true })
    phone?: string;

    @Column({ type: "varchar", length: 100, nullable: true })
    country?: string;

    @Column({ type: "varchar", length: 6, nullable: true })
    otp!: string | null;

    @Column({ type: "bigint", nullable: true })
    otpExpires!: number | null; // timestamp in ms

    @Column({ type: "boolean", default: false })
    isVerified!: boolean; // new field

    @Column({ type: "enum", enum: ["admin", "user"], default: "user" })
    role!: "admin" | "user";

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;
}

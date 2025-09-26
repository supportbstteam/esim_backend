// src/entity/Admin.ts

import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from "typeorm";

/**
 * Admin entity for MySQL using TypeORM
 * - Auto-generated primary key `id`
 * - Unique username
 * - Automatic `createdAt` and `updatedAt` timestamps
 * - Indexes for faster queries
 */

@Entity({ name: "admins" })
export class Admin {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Column({ type: "varchar", length: 255 })
    @Index() // creates an index on name column
    name!: string;

    @Column({ type: "varchar", length: 255, unique: true })
    username!: string;

    @Column({ type: "varchar", length: 255 })
    password!: string;

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;
}

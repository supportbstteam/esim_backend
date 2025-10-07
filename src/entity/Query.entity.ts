import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from "typeorm";

@Entity({ name: "queries" })
export class Query {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Column({ type: "varchar", length: 100 })
    firstName!: string;

    @Column({ type: "varchar", length: 100 })
    lastName!: string;

    @Column({ type: "varchar", length: 150 })
    email!: string;

    @Column({ type: "varchar", length: 20 })
    phone!: string;

    @Column({ type: "text" })
    message!: string;

    @Column({ type: "boolean", default: false })
    isDeleted!: boolean;

    @CreateDateColumn({ type: "timestamp" })
    createdAt!: Date;

    @UpdateDateColumn({ type: "timestamp" })
    updatedAt!: Date;
}

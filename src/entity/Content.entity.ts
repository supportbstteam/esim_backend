import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from "typeorm";

@Entity()
export class Content {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Column({ unique: true })
    page!: string; // e.g., "about", "privacy"

    @Column("longtext")
    html!: string;

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;
}

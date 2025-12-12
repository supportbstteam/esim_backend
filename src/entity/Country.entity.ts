// src/entity/Country.ts
import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
} from "typeorm";

/**
 * Country entity for MySQL using TypeORM
 */
@Entity({ name: "countries" })
export class Country {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Column({ type: "varchar", length: 255, unique: true })
    name!: string;

    @Column({ type: "text", nullable: true, comment: "Detailed description of the country" })
    description?: string;

    @Column({ type: "varchar", length: 2, unique: true })
    isoCode!: string;

    @Column({ type: "varchar", length: 3, nullable: true })
    iso3Code?: string;

    @Column({ type: "varchar", length: 500, nullable: true, comment: "Country flag or representative image URL" })
    imageUrl?: string;

    @Column({ type: "varchar", length: 10 })
    phoneCode!: string;

    @Column({ type: "varchar", length: 50 })
    currency!: string;

    @Column({ type: "boolean", default: true })
    isActive!: boolean;

    @Column({ type: "boolean", default: false })
    isDelete!: boolean;

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;
}

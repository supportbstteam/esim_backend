import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
} from "typeorm";
import { User } from "./User.entity";

@Entity({ name: "blogs" })
export class Blog {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Column({ type: "varchar", length: 255 })
    title!: string;

    // HTML content
    @Column({ type: "text" })
    content!: string;

    // HTML content
    @Column({ type: "text", nullable:true })
    summary!: string;

    // Optional cover image (URL)
    @Column({ type: "varchar", length: 500, nullable: true })
    coverImage?: string | null;

    // Optional category (Tech, Travel, etc.)
    @Column({ type: "varchar", length: 100, nullable: true })
    category?: string | null;

    // Draft or published
    @Column({ type: "boolean", default: false })
    isActive!: boolean;

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;
}

// src/entities/PageSection.entity.ts
import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    CreateDateColumn,
    UpdateDateColumn,
} from "typeorm";
import { Page } from "./Page.entity";

@Entity({ name: "page_sections" })
export class PageSection {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Column({ nullable: true })
    template!: string; // "template1", "template2", ...

    @Column({
        type: "json",
        nullable: false,
        default: () => "'{}'"
    })
    data!: Record<string, any>;

    @Column({ type: "int" })
    order!: number;

    @ManyToOne(() => Page, (page) => page.sections, {
        onDelete: "CASCADE",
        nullable: true
    })
    page!: Page;

    // @CreateDateColumn()
    // createdAt!: Date;

    // @UpdateDateColumn()
    // updatedAt!: Date;
}

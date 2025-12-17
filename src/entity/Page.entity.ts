// src/entities/Page.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";
import { PageSection } from "./PageSection.entity";

@Entity({ name: "pages" })
export class Page {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ unique: true, nullable:true })
  page!: string; // "privacy-policy", "terms-and-conditions"

  @OneToMany(() => PageSection, (section) => section.page, {
    cascade: true,
    nullable:true
  })
  sections!: PageSection[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

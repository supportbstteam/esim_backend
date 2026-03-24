// src/entities/PageSection.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
} from "typeorm";
import { Page } from "./Page.entity";

@Entity({ name: "page_sections" })
export class PageSection {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  // template name like templateBanner, template8 etc.
  @Column({ type: "varchar", nullable: true })
  template!: string;

  // JSON data (can contain HTML inside content)
  @Column({
    type: "json",
    nullable: true,
  })
  data!: {
    content?: string;
    [key: string]: any;
  };

  // order of section on page
  @Column({ type: "int" })
  order!: number;

  // relation with page
  @ManyToOne(() => Page, (page) => page.sections, {
    onDelete: "CASCADE",
    nullable: true,
  })
  page!: Page;
}
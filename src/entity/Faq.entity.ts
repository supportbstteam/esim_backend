// entity/Faq.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from "typeorm";

@Entity()
export class Faq {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column()
  question!: string;

  @Column("text")
  answer!: string;

  @Column({ default: 0 })
  order!: number; // optional, for ordering FAQs

  @Column({ default: true })
  isActive!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

// src/entities/Image.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from "typeorm";

@Entity({ name: "images" })
export class Image {
  @PrimaryGeneratedColumn() // ✅ auto-increment integer
  id!: number;

  @Column()
  originalName!: string;

  @Column()
  fileName!: string;

  @Column()
  mimeType!: string;

  @Column()
  size!: number;

  @Column()
  filePath!: string; // absolute path on desktop

  @CreateDateColumn()
  createdAt!: Date;
}

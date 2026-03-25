import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToMany,
} from "typeorm";
import { Banner } from "./Banner.entity";

@Entity({ name: "images" })
export class Image {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  originalName!: string;

  @Column()
  fileName!: string;

  @Column({ type: "varchar", nullable: true })
  name?: string | null;

  @Column()
  mimeType!: string;

  @Column()
  size!: number;

  @Column()
  filePath!: string;

  // ✅ Many images can belong to many banners
  // @ManyToMany(() => Banner, (banner) => banner.images)
  // banners!: Banner[];

  @CreateDateColumn()
  createdAt!: Date;
}

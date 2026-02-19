import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  JoinTable,
} from "typeorm";
import { Image } from "./Images.entity";

@Entity({ name: "banners" })
export class Banner {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  heading!: string;

  @Column({ nullable: true })
  subHeading!: string;

  // ✅ Many banners can have many images
  @ManyToMany(() => Image, (image) => image.banners, {
    cascade: true,
  })
  @JoinTable({
    name: "banner_images", // junction table name
    joinColumn: {
      name: "bannerId",
      referencedColumnName: "id",
    },
    inverseJoinColumn: {
      name: "imageId",
      referencedColumnName: "id",
    },
  })
  sections!: Image[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

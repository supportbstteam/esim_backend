import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  JoinTable,
  OneToOne,
  JoinColumn,
} from "typeorm";
import { Image } from "./Images.entity";
import { Page } from "./Page.entity";

@Entity({ name: "banners" })
export class Banner {

  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  heading!: string;

  @Column({ nullable: true })
  subHeading!: string;


  // FIXED NAME
  // @ManyToMany(() => Image, (image) => image.banners, {
  //   cascade: true,
  // })
  // @JoinTable({
  //   name: "banner_images",
  //   joinColumn: {
  //     name: "bannerId",
  //     referencedColumnName: "id",
  //   },
  //   inverseJoinColumn: {
  //     name: "imageId",
  //     referencedColumnName: "id",
  //   },
  // })
  // images!: Image[];


  @OneToOne(() => Page, (page) => page.banner, {
    onDelete: "CASCADE",
  })
  @JoinColumn({
    name: "pageId"
  })
  page!: Page;


  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

}

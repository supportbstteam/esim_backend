// src/entity/NotificationContent.entity.ts
import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
} from "typeorm";

@Entity({ name: "notification_content" })
export class NotificationContent {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ length: 100, unique: true })
  code!: string; // ✅ IMPORTANT (e.g. ORDER_PLACED, ESIM_ACTIVATED)

  @Column({ length: 255 })
  title!: string;

  @Column({ type: "text", nullable: true })
  message?: string;

  @Column({ length: 50, default: "system" })
  type!: string; // system | order | esim | payment

  @Column({ length: 500, nullable: true })
  actionUrl?: string; // deep link / screen

  @Column({ default: true })
  isActive!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

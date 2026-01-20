// src/entity/Notification.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { User } from "./User.entity";
import { NotificationContent } from "./NotificationContent.entity";

export enum NotificationStatus {
  PENDING = "PENDING",
  SENT = "SENT",
  FAILED = "FAILED",
}

@Entity({ name: "notifications" })
export class Notification {
  @PrimaryGeneratedColumn()
  id!: number;

  /**
   * User who receives the notification
   */
  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "userId" })
  user!: User;

  @Column("uuid")
  userId!: string;

  /**
   * Dynamic payload data for Firebase `data` object
   */
  @Column({ type: "json", nullable: true })
  meta?: Record<string, any>;

  /**
   * Notification content/template
   */
  @ManyToOne(() => NotificationContent, { eager: true })
  @JoinColumn({ name: "contentId" })
  content!: NotificationContent;

  @Column()
  contentId!: number;

  /**
   * Read status (frontend concern)
   */
  @Column({ default: false })
  isRead!: boolean;

  /**
   * Push delivery status (backend concern)
   */
  @Column({
    type: "enum",
    enum: NotificationStatus,
    default: NotificationStatus.PENDING,
  })
  status!: NotificationStatus;

  /**
   * Firebase send error (if failed)
   */
  @Column({ type: "text", nullable: true })
  error?: string;

  /**
   * When push was successfully sent
   */
  @Column({ type: "timestamp", nullable: true })
  sentAt?: Date;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

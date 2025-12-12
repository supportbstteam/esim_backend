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
/**
 * Notification entity — used for all user/system alerts
 * Examples:
 * - "Your eSIM has been activated."
 * - "You have 500MB remaining."
 * - "Plan expired — renew now."
 */
@Entity({ name: "notifications" })
export class Notification {
    @PrimaryGeneratedColumn() // ✅ auto-increment (INT)
    id!: number;

    /**
     * User who receives the notification
     */
    @ManyToOne(() => User, { onDelete: "CASCADE" })
    @JoinColumn({ name: "userId" })
    user!: User;

    @Column("uuid")
    userId!: string;

    @Column({ type: "json", nullable: true })
    meta?: any;

    /**
     * Notification content/template
     */
    @ManyToOne(() => NotificationContent, { eager: true })
    @JoinColumn({ name: "contentId" })
    content!: NotificationContent;

    @Column()
    contentId!: number; // ✅ FIXED

    @Column({ default: false })
    isRead!: boolean;

    @Column({ default: false })
    isSent!: boolean;

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;
}
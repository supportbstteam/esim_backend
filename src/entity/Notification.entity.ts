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

/**
 * Notification entity — used for all user/system alerts
 * Examples:
 * - "Your eSIM has been activated."
 * - "You have 500MB remaining."
 * - "Plan expired — renew now."
 */
@Entity({ name: "notifications" })
export class Notification {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    /**
     * User the notification belongs to
     */
    @ManyToOne(() => User, { nullable: true, onDelete: "CASCADE" })
    @JoinColumn({ name: "userId" })
    user?: User;

    @Column({ type: "uuid", nullable: true })
    userId?: string;

    /**
     * Notification title (short summary)
     */
    @Column({ type: "varchar", length: 255 })
    title!: string;

    /**
     * Detailed message body
     */
    @Column({ type: "text", nullable: true })
    message?: string;

    /**
     * Notification type — to group by context
     * Examples: system, order, plan, esim, data_usage, payment, topup
     */
    @Column({ type: "varchar", length: 50, default: "system" })
    type!: string;

    /**
     * Whether the notification has been read by the user
     */
    @Column({ type: "boolean", default: false })
    isRead!: boolean;

    /**
     * Whether the notification should also be sent via email/push
     */
    @Column({ type: "boolean", default: false })
    isSent!: boolean;

    /**
     * Optional action URL or related page (e.g., /orders/123)
     */
    @Column({ type: "varchar", length: 500, nullable: true })
    actionUrl?: string;

    /**
     * Status — active or deleted/expired
     */
    @Column({ type: "boolean", default: true })
    isActive!: boolean;

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;
}

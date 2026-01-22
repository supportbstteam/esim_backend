// src/entity/UserDevice.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  UpdateDateColumn,
} from "typeorm";

@Entity('user_devices')
export class UserDevice {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  userId!: string;

  @Column({ unique: true })
  token!: string; // 🔥 FCM TOKEN

  @Column()
  platform!: 'android' | 'ios';

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

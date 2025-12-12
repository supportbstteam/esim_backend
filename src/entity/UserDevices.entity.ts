// src/entity/UserDevice.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from "typeorm";

@Entity({ name: "user_devices" })
export class UserDevice {

  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Index()
  @Column()
  userId!: string;

  @Index({ unique: true })
  @Column()
  playerId!: string; // OneSignal player_id

  @Column({ default: "android" })
  platform!: "android" | "ios";

  @CreateDateColumn()
  createdAt!: Date;
}

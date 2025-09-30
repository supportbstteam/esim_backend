import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from "typeorm";

@Entity({ name: "tokens" })
export class Token {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ length: 100 })
  provider!: string; // e.g. "Turisim API"

  @Column({ type: "text" })
  token!: string;

  @Column({ type: "timestamp" })
  expiry!: Date;

  @CreateDateColumn({ type: "timestamp" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamp" })
  updatedAt!: Date;
}

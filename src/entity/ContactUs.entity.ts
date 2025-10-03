import { Entity, PrimaryGeneratedColumn, Column } from "typeorm";

@Entity()
export class Contact {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Column()
    type!: string; // e.g. "Phone", "Email"

    @Column()
    value!: string; // e.g. "+91 9876543210" or "support@example.com"

    @Column({ nullable: true })
    position!: string; // e.g. "Support", "Sales", etc.
}

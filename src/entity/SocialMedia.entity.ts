import { Entity, PrimaryGeneratedColumn, Column } from "typeorm";

@Entity()
export class Social {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Column()
    type!: string; // e.g. "Facebook", "Twitter", "LinkedIn"

    @Column()
    link!: string; // e.g. "https://facebook.com/company"
}

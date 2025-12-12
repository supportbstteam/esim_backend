import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    BeforeInsert,
} from "typeorm";
import { v4 as uuid } from "uuid";

export enum QueryStatus {
    PENDING = "PENDING",
    IN_PROGRESS = "IN_PROGRESS",
    RESOLVED = "RESOLVED",
    CLOSED = "CLOSED",
}

@Entity({ name: "queries" })
export class Query {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Column({ type: "varchar", unique: true })
    queryId!: string;

    @Column({ type: "varchar", length: 100 })
    firstName!: string;

    @Column({ type: "varchar", length: 100 })
    lastName!: string;

    @Column({ type: "varchar", length: 150 })
    email!: string;

    @Column({ type: "varchar", length: 20, nullable:true })
    phone!: string;

    @Column({ type: "text" })
    message!: string;

    @Column({
        type: "enum",
        enum: QueryStatus,
        default: QueryStatus.PENDING,
    })
    status!: QueryStatus;

    @Column({ type: "boolean", default: false })
    isDeleted!: boolean;

    @CreateDateColumn({ type: "timestamp" })
    createdAt!: Date;

    @UpdateDateColumn({ type: "timestamp" })
    updatedAt!: Date;

    @BeforeInsert()
    generateQueryId() {
        this.queryId = `QUERY-${uuid()}`;
    }
}

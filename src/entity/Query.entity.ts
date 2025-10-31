import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    BeforeInsert,
} from "typeorm";

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
    queryId!: string; // e.g. QUERY0001

    @Column({ type: "varchar", length: 100 })
    firstName!: string;

    @Column({ type: "varchar", length: 100 })
    lastName!: string;

    @Column({ type: "varchar", length: 150 })
    email!: string;

    @Column({ type: "varchar", length: 20 })
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

    // 👇 Generate QUERY + padded number before insert
    @BeforeInsert()
    async generateQueryId() {
        // When inserting, id doesn’t exist yet, so we handle numbering manually
        const latestQuery = await Query.repo
            .createQueryBuilder("q")
            .orderBy("q.id", "DESC")
            .getOne();

        const nextNumber = latestQuery ? latestQuery.id + 1 : 1;
        this.queryId = `QUERY${nextNumber.toString().padStart(4, "0")}`;
    }

    // static helper to get repository (to use in @BeforeInsert)
    static get repo() {
        const { AppDataSource } = require("../data-source");
        return AppDataSource.getRepository(Query);
    }
}

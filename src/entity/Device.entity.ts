import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    Index,
    Unique,
    ManyToOne,
    JoinColumn,
} from "typeorm";
import { Brand } from "./Brand.entity";

export enum DeviceOS {
    ANDROID = "ANDROID",
    IOS = "IOS",
    WINDOWS = "WINDOWS",
    OTHER = "OTHER",
}

@Entity()
@Unique(["brand", "model", "os"])
@Index(["model"])
@Index(["os"])
@Index(["isActive"])
export class Device {

    @PrimaryGeneratedColumn()
    id!: number;

    // -----------------------------
    // RELATION
    // -----------------------------

    @ManyToOne(() => Brand, (brand) => brand.devices, {
        onDelete: "CASCADE",   // 🔥 THIS IS WHAT YOU WANT
        eager: true,           // auto-fetch brand
    })
    @JoinColumn({ name: "brandId" })
    brand!: Brand;

    @Column()
    brandId!: number;

    // -----------------------------
    // Device Info
    // -----------------------------

    @Column({ length: 160 })
    @Index()
    model!: string;

    @Column({
        type: "enum",
        enum: DeviceOS,
        enumName: "device_os_enum",
    })
    os!: DeviceOS;

    // -----------------------------
    // Capabilities
    // -----------------------------

    @Column({ default: true })
    supportsEsim!: boolean;

    // -----------------------------
    // Metadata
    // -----------------------------

    @Column({ type: "text", nullable: true })
    notes!: string | null;

    @Column({ type: "text", nullable: true })
    name!: string | null;

    @Column({ default: true })
    isActive!: boolean;

    // -----------------------------
    // Audit
    // -----------------------------

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;
}

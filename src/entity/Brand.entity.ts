import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    OneToMany,
    CreateDateColumn,
    UpdateDateColumn,
    Index,
    Unique,
} from "typeorm";

import { Device } from "./Device.entity";

@Entity()
@Unique("UQ_brand_name", ["name"])   // explicit name prevents collisions
@Index("IDX_brand_active", ["isActive"])
export class Brand {

    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ length: 120 })
    name!: string;                   // ❌ removed @Index()

    @Column({ default: true })
    isActive!: boolean;

    @OneToMany(() => Device, (device) => device.brand)
    devices!: Device[];

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;
}

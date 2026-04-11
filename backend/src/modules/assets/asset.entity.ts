import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { AssetType } from '../../common/enums/index.js';
import { Organization } from '../organizations/organization.entity.js';
import { User } from '../users/user.entity.js';
import { Scan } from '../scans/scan.entity.js';
import { ScanSchedule } from '../schedules/scan-schedule.entity.js';

@Entity('assets')
export class Asset {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 100 })
  name!: string;

  @Column({ type: 'enum', enum: AssetType })
  type!: AssetType;

  @Column({ type: 'varchar', length: 255 })
  value!: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;

  @ManyToOne(() => Organization, (org) => org.assets, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'org_id' })
  organization!: Organization;

  @Column({ name: 'org_id' })
  orgId!: string;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'created_by' })
  createdByUser!: User | null;

  @Column({ name: 'created_by', nullable: true })
  createdBy!: string | null;

  @OneToMany(() => Scan, (scan) => scan.asset)
  scans!: Scan[];

  @OneToMany(() => ScanSchedule, (schedule) => schedule.asset)
  schedules!: ScanSchedule[];
}

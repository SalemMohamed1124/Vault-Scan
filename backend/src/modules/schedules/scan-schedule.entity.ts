import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ScanType, ScanFrequency } from '../../common/enums/index.js';
import { Asset } from '../assets/asset.entity.js';
import { Organization } from '../organizations/organization.entity.js';
import { User } from '../users/user.entity.js';

@Entity('scan_schedules')
export class ScanSchedule {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'enum', enum: ScanType, name: 'scan_type' })
  scanType!: ScanType;

  @Column({ type: 'enum', enum: ScanFrequency })
  frequency!: ScanFrequency;

  @Column({ type: 'integer', name: 'day_of_week', nullable: true })
  dayOfWeek!: number | null;

  @Column({ type: 'varchar', length: 5, name: 'time_of_day' })
  timeOfDay!: string;

  @Column({ type: 'timestamptz', name: 'next_run_at' })
  nextRunAt!: Date;

  @Column({ type: 'boolean', name: 'is_active', default: true })
  isActive!: boolean;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @ManyToOne(() => Asset, (asset) => asset.schedules, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'asset_id' })
  asset!: Asset;

  @Column({ name: 'asset_id' })
  assetId!: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'org_id' })
  organization!: Organization;

  @Column({ name: 'org_id' })
  orgId!: string;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'created_by' })
  createdByUser!: User | null;

  @Column({ name: 'created_by', nullable: true })
  createdBy!: string | null;
}

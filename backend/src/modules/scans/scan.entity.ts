import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
  OneToOne,
} from 'typeorm';
import { ScanType, ScanStatus } from '../../common/enums/index.js';
import { Asset } from '../assets/asset.entity.js';
import { Organization } from '../organizations/organization.entity.js';
import { User } from '../users/user.entity.js';
import { ScanFinding } from '../findings/scan-finding.entity.js';
import { AIAnalysis } from '../ai-analysis/ai-analysis.entity.js';
import { Report } from '../reports/report.entity.js';

@Entity('scans')
export class Scan {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'enum', enum: ScanType })
  type!: ScanType;

  @Column({ type: 'enum', enum: ScanStatus, default: ScanStatus.PENDING })
  status!: ScanStatus;

  @Column({ type: 'boolean', name: 'is_scheduled', default: false })
  isScheduled!: boolean;

  @Column({ type: 'timestamptz', name: 'started_at', nullable: true })
  startedAt!: Date | null;

  @Column({ type: 'timestamptz', name: 'completed_at', nullable: true })
  completedAt!: Date | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @ManyToOne(() => Asset, (asset) => asset.scans, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'asset_id' })
  asset!: Asset;

  @Column({ name: 'asset_id' })
  assetId!: string;

  @ManyToOne(() => Organization, (org) => org.scans, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'org_id' })
  organization!: Organization;

  @Column({ name: 'org_id' })
  orgId!: string;

  @ManyToOne(() => User, (user) => user.scans, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'initiated_by' })
  initiatedByUser!: User | null;

  @Column({ name: 'initiated_by', nullable: true })
  initiatedBy!: string | null;

  @OneToMany(() => ScanFinding, (finding) => finding.scan)
  findings!: ScanFinding[];

  @OneToOne(() => AIAnalysis, (analysis) => analysis.scan)
  aiAnalysis!: AIAnalysis;

  @OneToMany(() => Report, (report) => report.scan)
  reports!: Report[];
}

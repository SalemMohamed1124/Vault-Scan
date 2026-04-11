import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ReportFormat } from '../../common/enums/index.js';
import { Scan } from '../scans/scan.entity.js';
import { User } from '../users/user.entity.js';

@Entity('reports')
export class Report {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'enum', enum: ReportFormat })
  format!: ReportFormat;

  @Column({ type: 'varchar', length: 500, name: 'file_path', nullable: true })
  filePath!: string | null;

  @Column({ type: 'varchar', length: 1000, name: 'download_url', nullable: true })
  downloadUrl!: string | null;

  @Column({ type: 'timestamptz', name: 'expires_at', nullable: true })
  expiresAt!: Date | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @ManyToOne(() => Scan, (scan) => scan.reports, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'scan_id' })
  scan!: Scan;

  @Column({ name: 'scan_id' })
  scanId!: string;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'created_by' })
  createdByUser!: User | null;

  @Column({ name: 'created_by', nullable: true })
  createdBy!: string | null;
}

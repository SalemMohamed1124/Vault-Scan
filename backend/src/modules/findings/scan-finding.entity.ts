import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Scan } from '../scans/scan.entity.js';
import { Vulnerability } from './vulnerability.entity.js';

@Entity('scan_findings')
export class ScanFinding {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text', nullable: true })
  evidence!: string | null;

  @Column({ type: 'varchar', length: 500 })
  location!: string;

  @Column({ type: 'text', name: 'raw_output', nullable: true })
  rawOutput!: string | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @ManyToOne(() => Scan, (scan) => scan.findings, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'scan_id' })
  scan!: Scan;

  @Column({ name: 'scan_id' })
  scanId!: string;

  @ManyToOne(() => Vulnerability, (vuln) => vuln.findings, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'vuln_id' })
  vulnerability!: Vulnerability;

  @Column({ name: 'vuln_id' })
  vulnId!: string;
}

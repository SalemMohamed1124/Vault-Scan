import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { AIAnalysisStatus, RiskLevel } from '../../common/enums/index.js';
import { Scan } from '../scans/scan.entity.js';

@Entity('ai_analyses')
export class AIAnalysis {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'enum', enum: AIAnalysisStatus, default: AIAnalysisStatus.PROCESSING })
  status!: AIAnalysisStatus;

  @Column({ type: 'varchar', length: 100, name: 'gemini_model' })
  geminiModel!: string;

  @Column({ type: 'integer', name: 'risk_score', nullable: true })
  riskScore!: number | null;

  @Column({ type: 'enum', enum: RiskLevel, name: 'risk_level', nullable: true })
  riskLevel!: RiskLevel | null;

  @Column({ type: 'text', name: 'analysis_text', nullable: true })
  analysisText!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  recommendations!: Record<string, unknown>[] | null;

  @Column({ type: 'jsonb', name: 'key_findings', nullable: true })
  keyFindings!: Record<string, unknown>[] | null;

  @Column({ type: 'jsonb', name: 'attack_vectors', nullable: true })
  attackVectors!: Record<string, unknown>[] | null;

  @Column({ type: 'text', name: 'technical_details', nullable: true })
  technicalDetails!: string | null;

  @Column({ type: 'text', name: 'compliance_notes', nullable: true })
  complianceNotes!: string | null;

  @Column({ type: 'integer', name: 'prompt_tokens', nullable: true })
  promptTokens!: number | null;

  @Column({ type: 'integer', name: 'completion_tokens', nullable: true })
  completionTokens!: number | null;

  @Column({ type: 'text', name: 'error_message', nullable: true })
  errorMessage!: string | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;

  @OneToOne(() => Scan, (scan) => scan.aiAnalysis, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'scan_id' })
  scan!: Scan;

  @Column({ name: 'scan_id', unique: true })
  scanId!: string;
}

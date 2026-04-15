import { AIAnalysisStatus, RiskLevel } from '../../../common/enums/index.js';

export interface KeyFinding {
  title: string;
  impact: string;
  likelihood: string;
}

export interface Recommendation {
  priority: number;
  action: string;
  rationale: string;
  effort: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface GeminiAnalysisResult {
  executiveSummary: string;
  riskScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  keyFindings: KeyFinding[];
  recommendations: Recommendation[];
  technicalDetails: string;
  attackVectors: string[];
  complianceNotes: string;
}

export interface AiAnalysisResponseDto {
  id: string;
  status: AIAnalysisStatus;
  riskScore: number | null;
  riskLevel: RiskLevel | null;
  analysisText: string | null;
  recommendations: Record<string, unknown>[] | null;
  keyFindings: Record<string, unknown>[] | null;
  attackVectors: string[] | null;
  technicalDetails: string | null;
  complianceNotes: string | null;
  promptTokens: number | null;
  completionTokens: number | null;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
}

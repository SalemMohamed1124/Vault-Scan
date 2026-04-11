import { ScanType, ScanStatus, SeverityLevel } from '../../../common/enums/index.js';

export interface ScanResponseDto {
  id: string;
  type: ScanType;
  status: ScanStatus;
  isScheduled: boolean;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  assetId: string;
  orgId: string;
  initiatedBy: string | null;
  findingsCount: number;
  severityCounts: SeverityCountsDto;
  asset?: { id: string; name: string; value: string; type: string };
  findingsSummary?: { critical: number; high: number; medium: number; low: number; total: number };
}

export interface SeverityCountsDto {
  critical: number;
  high: number;
  medium: number;
  low: number;
}

export interface ScanListResponseDto {
  data: ScanResponseDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ScanFindingResponseDto {
  id: string;
  evidence: string | null;
  location: string;
  rawOutput: string | null;
  createdAt: Date;
  vulnerability: {
    id: string;
    name: string;
    severity: SeverityLevel;
    description: string;
    remediation: string;
    category: string;
    cveId: string | null;
  };
}

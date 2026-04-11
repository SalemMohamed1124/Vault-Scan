// ─── Auth ────────────────────────────────────────
export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
  organizations: Organization[];
}

// ─── Enums ───────────────────────────────────────
export type AssetType = "DOMAIN" | "IP" | "URL" | "CIDR";
export type ScanType = "QUICK" | "DEEP";
export type ScanStatus =
  | "PENDING"
  | "RUNNING"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED";
export type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
export type OrgRole = "ADMIN" | "EDITOR" | "VIEWER";
export type ReportFormat = "PDF" | "JSON" | "HTML";

export interface User {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

export interface Organization {
  id: string;
  name: string;
  role: OrgRole;
  createdAt: string;
}

export interface OrganizationMember {
  id: string;
  userId: string;
  organizationId: string;
  role: OrgRole;
  user?: User;
}

export interface OrgMember {
  id: string;
  role: OrgRole;
  joinedAt: string;
  user: {
    id: string;
    name: string;
    email: string;
  };
}

export interface Asset {
  id: string;
  orgId: string;
  name: string;
  type: AssetType;
  value: string;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface AssetStats {
  total: number;
  byType: Record<AssetType, number>;
  lastScannedAt: string | null;
  totalVulnerabilities: number;
  criticalCount: number;
}

export interface Scan {
  id: string;
  assetId: string;
  orgId: string;
  type: ScanType;
  status: ScanStatus;
  isScheduled: boolean;
  initiatedBy: string;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  progress: number;
  asset?: Asset;
  findingsSummary?: FindingsSummary;
  severityCounts?: Omit<FindingsSummary, "total">;
  findingsCount?: number;
}

export interface Vulnerability {
  id: string;
  name: string;
  severity: Severity;
  description: string;
  remediation: string;
  category: string;
}

export interface ScanFinding {
  id: string;
  scanId: string;
  vulnerabilityId?: string;
  evidence: string;
  location: string;
  rawOutput?: string;
  vulnerability?: Vulnerability;
  scan?: Scan;
}

export interface FindingsSummary {
  critical: number;
  high: number;
  medium: number;
  low: number;
  total: number;
}

export interface AiRecommendation {
  priority: number;
  action: string;
  rationale: string;
  effort: "LOW" | "MEDIUM" | "HIGH";
}

export interface AiKeyFinding {
  title: string;
  impact: string;
  likelihood: string;
}

export interface AiAnalysis {
  id: string;
  scanId: string;
  status: "PROCESSING" | "COMPLETED" | "FAILED";
  riskScore: number | null;
  riskLevel: Severity | null;
  analysisText: string | null;
  recommendations: AiRecommendation[];
  keyFindings: AiKeyFinding[];
  attackVectors: string[];
  technicalDetails: string | null;
  complianceNotes: string | null;
  createdAt: string;
}

export interface ScanSchedule {
  id: string;
  assetId: string;
  frequency: "DAILY" | "WEEKLY" | "MONTHLY";
  nextRunAt: string;
  isActive: boolean;
  scanType: ScanType;
  asset?: Asset;
}

export interface Report {
  id: string;
  scanId: string;
  scan?: {
    id: string;
    type: ScanType;
    asset?: { id: string; name: string; value: string; type: AssetType };
  };
  format: ReportFormat;
  filePath: string;
  downloadUrl: string;
  expiresAt: string;
  createdAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  type: string;
  message: string;
  isRead: boolean;
  metadata: Record<string, unknown>;
  createdAt: string;
}

// ─── Auth Mode ───────────────────────────────────
export type AuthMode = "auto" | "credentials" | "cookies" | "none";

// ─── Request Payloads ────────────────────────────
export interface StartScanPayload {
  assetId: string;
  type: ScanType;
  authMode?: AuthMode;
  username?: string;
  password?: string;
  loginUrl?: string;
  cookies?: string;
  customHeaders?: string;
}

export interface CreateSchedulePayload {
  assetId: string;
  scanType: ScanType;
  frequency: "DAILY" | "WEEKLY" | "MONTHLY";
  nextRunAt: string;
}

export interface ChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
}

export interface BulkCreateAssetItem {
  name: string;
  type: AssetType;
  value: string;
}

// ─── AI Chat ─────────────────────────────────────
export interface ChatMessage {
  role: "user" | "model";
  content: string;
}

// ─── Activity Feed ───────────────────────────────
export type ActivityType =
  | "scan_completed"
  | "scan_failed"
  | "finding_found"
  | "report_generated"
  | "asset_added";


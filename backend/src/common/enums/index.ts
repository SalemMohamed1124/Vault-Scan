export enum UserRole {
  ADMIN = 'ADMIN',
  EDITOR = 'EDITOR',
  VIEWER = 'VIEWER',
}

export enum AssetType {
  DOMAIN = 'DOMAIN',
  IP = 'IP',
  URL = 'URL',
  CIDR = 'CIDR',
}

export enum ScanType {
  QUICK = 'QUICK',
  DEEP = 'DEEP',
}

export enum ScanStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  FAILED = 'FAILED',
}

export enum SeverityLevel {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export enum RiskLevel {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export enum ScanFrequency {
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
}

export enum ReportFormat {
  PDF = 'PDF',
  JSON = 'JSON',
  HTML = 'HTML',
}

export enum NotificationType {
  SCAN_COMPLETE = 'SCAN_COMPLETE',
  SCAN_FAILED = 'SCAN_FAILED',
  AI_ANALYSIS_READY = 'AI_ANALYSIS_READY',
  CRITICAL_VULN = 'CRITICAL_VULN',
}

export enum AIAnalysisStatus {
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

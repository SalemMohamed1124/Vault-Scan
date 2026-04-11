import api from "@/lib/api";
import type { Scan } from "@/types";

export async function fetchDashboardStats() {
  const { data } = await api.get("/api/dashboard/stats");
  return data as {
    totalAssets: number;
    activeScans: number;
    openFindings: number;
    criticalIssues: number;
  };
}

export async function fetchSecurityScore() {
  const { data } = await api.get("/api/dashboard/security-score");
  return data as {
    score: number;
    grade: string;
    previousScore: number;
    trend: "up" | "down" | "stable";
    breakdown: {
      vulnerabilities: number;
      scanCoverage: number;
      responseTime: number;
    };
  };
}

export async function fetchVulnTrends() {
  const { data } = await api.get("/api/dashboard/vulnerability-trends");
  return data as any[];
}

export async function fetchScanActivity() {
  const { data } = await api.get("/api/dashboard/scan-activity");
  return data as any[];
}

export async function fetchTopVulns() {
  const { data } = await api.get("/api/dashboard/top-vulnerabilities");
  return data as any[];
}

export async function fetchRecentActivity() {
  const { data } = await api.get("/api/dashboard/recent-activity");
  return data as any[];
}

export async function fetchRecentScans() {
  const { data } = await api.get("/api/scans", { params: { limit: 5, page: 1 } });
  return ((data as any).data ?? data) as Scan[];
}

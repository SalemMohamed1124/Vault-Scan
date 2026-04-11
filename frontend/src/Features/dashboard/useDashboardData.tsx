"use client";

import { useQuery } from "@tanstack/react-query";
import type { Scan } from "@/types";
import { 
  fetchDashboardStats, 
  fetchSecurityScore, 
  fetchVulnTrends, 
  fetchScanActivity, 
  fetchTopVulns, 
  fetchRecentActivity, 
  fetchRecentScans 
} from "@/Services/Dashboard";

export function useDashboardStats() {
  return useQuery({
    queryKey: ["dashboard", "stats"],
    queryFn: fetchDashboardStats,
  });
}

export function useSecurityScore() {
  return useQuery({
    queryKey: ["dashboard", "security-score"],
    queryFn: fetchSecurityScore,
  });
}

export function useVulnTrends() {
  return useQuery({
    queryKey: ["dashboard", "vuln-trends"],
    queryFn: fetchVulnTrends,
  });
}

export function useScanActivity() {
  return useQuery({
    queryKey: ["dashboard", "scan-activity"],
    queryFn: fetchScanActivity,
  });
}

export function useTopVulns() {
  return useQuery({
    queryKey: ["dashboard", "top-vulns"],
    queryFn: fetchTopVulns,
  });
}

export function useRecentActivity() {
  return useQuery({
    queryKey: ["dashboard", "recent-activity"],
    queryFn: fetchRecentActivity,
  });
}

export function useRecentScans() {
  return useQuery({
    queryKey: ["dashboard", "recent-scans"],
    queryFn: fetchRecentScans,
  });
}

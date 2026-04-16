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
  const query = useQuery({
    queryKey: ["dashboard", "stats"],
    queryFn: fetchDashboardStats,
  });

  return {
    stats: query.data ?? null,
    isPending: query.isPending,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

export function useSecurityScore() {
  const query = useQuery({
    queryKey: ["dashboard", "security-score"],
    queryFn: fetchSecurityScore,
  });

  return {
    score: query.data ?? null,
    isPending: query.isPending,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

export function useVulnTrends() {
  const query = useQuery({
    queryKey: ["dashboard", "vuln-trends"],
    queryFn: fetchVulnTrends,
  });

  return {
    trends: query.data ?? null,
    isPending: query.isPending,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

export function useScanActivity() {
  const query = useQuery({
    queryKey: ["dashboard", "scan-activity"],
    queryFn: fetchScanActivity,
  });

  return {
    activity: query.data ?? null,
    isPending: query.isPending,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

export function useTopVulns() {
  const query = useQuery({
    queryKey: ["dashboard", "top-vulns"],
    queryFn: fetchTopVulns,
  });

  return {
    vulns: query.data ?? null,
    isPending: query.isPending,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

export function useRecentActivity() {
  const query = useQuery({
    queryKey: ["dashboard", "recent-activity"],
    queryFn: fetchRecentActivity,
  });

  return {
    activity: query.data ?? null,
    isPending: query.isPending,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

export function useRecentScans() {
  const query = useQuery({
    queryKey: ["dashboard", "recent-scans"],
    queryFn: fetchRecentScans,
  });

  return {
    scans: query.data ?? null,
    isPending: query.isPending,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

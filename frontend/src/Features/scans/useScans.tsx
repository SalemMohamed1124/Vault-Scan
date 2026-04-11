"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import type { ScanStatus } from "@/types";
import { fetchScans } from "@/Services/Scans";

import { calculateScanStats } from "@/lib/scan-utils";

export function useScans(params: {
  page?: number;
  limit?: number;
  status?: ScanStatus | "ALL";
  search?: string;
}) {
  const {
    data: scans,
    isPending,
    error,
  } = useQuery({
    queryKey: ["scans", params],
    queryFn: () => fetchScans(params),
    refetchInterval: (query) => {
      // If any scan is still running, refetch more frequently
      const hasRunning = query.state.data?.data?.some(s => s.status === "RUNNING");
      return hasRunning ? 5000 : 30000;
    }
  });

  return { scans, isPending, error };
}

export function useScansStats() {
  const { scans, isPending } = useScans({ limit: 100 });
  
  const stats = useMemo(() => {
    if (!scans?.data) return { total: 0, runningNow: 0, completedToday: 0, avgDuration: "--" };
    return calculateScanStats(scans.data, scans.total);
  }, [scans]);

  return { data: stats, isPending };
}

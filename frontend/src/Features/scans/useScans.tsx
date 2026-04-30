"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import type { ScanStatus, Scan, ScanFinding } from "@/types";
import {
  fetchScans,
  fetchScan,
  fetchScanFindings,
  fetchScanRawOutput,
} from "@/Services/Scans";

import { calculateScanStats } from "@/lib/scan-utils";

export function useScans(params: {
  page?: number;
  limit?: number;
  status?: ScanStatus | "ALL";
  search?: string;
}) {
  const query = useQuery({
    queryKey: ["scans", params],
    queryFn: () => fetchScans(params),
    refetchInterval: (queryState) => {
      // Poll frequently while any scan is pending or running
      const hasActive = queryState.state.data?.data?.some(
        (s) => s.status === "RUNNING" || s.status === "PENDING",
      );
      return hasActive ? 5000 : 30000;
    },
  });

  const items = query.data?.data ?? [];
  const total = query.data?.total ?? 0;
  const isEmpty = !query.isPending && !query.isError && items.length === 0;

  return {
    items,
    total,
    isPending: query.isPending,
    isError: query.isError,
    error: query.error,
    isEmpty,
    refetch: query.refetch,
  };
}

export function useScansStats() {
  const { items, isPending } = useScans({ limit: 100 });

  const stats = useMemo(() => {
    if (!items || items.length === 0)
      return { total: 0, runningNow: 0, completedToday: 0, avgDuration: "--" };
    return calculateScanStats(items, items.length);
  }, [items]);

  return {
    stats,
    isPending,
  };
}

export function useScan(id: string) {
  const query = useQuery<Scan | null>({
    queryKey: ["scan", id],
    queryFn: () => fetchScan(id),
    enabled: !!id,
    refetchInterval: (queryState) => {
      const status = queryState?.state?.data?.status;
      // Poll while the scan is pending (queued) or actively running
      return status === "RUNNING" || status === "PENDING" ? 3000 : false;
    },
  });

  return {
    scan: query.data ?? null,
    isPending: query.isPending,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

export function useScanFindings(id: string) {
  const query = useQuery<ScanFinding[]>({
    queryKey: ["scan-findings", id],
    queryFn: () => fetchScanFindings(id),
    enabled: !!id,
  });

  const items = query.data ?? [];
  const isEmpty = !query.isPending && !query.isError && items.length === 0;

  return {
    items,
    isPending: query.isPending,
    isError: query.isError,
    error: query.error,
    isEmpty,
    refetch: query.refetch,
  };
}

export function useScanRawOutput(id: string) {
  const query = useQuery<string>({
    queryKey: ["scan-raw", id],
    queryFn: async () => {
      try {
        const data = await fetchScanRawOutput(id);
        if (typeof data === "string") return data;
        return JSON.stringify(data, null, 2);
      } catch {
        return "No raw output available.";
      }
    },
    enabled: !!id,
  });

  return {
    content: query.data ?? "",
    isPending: query.isPending,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

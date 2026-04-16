"use client";

import { useQuery } from "@tanstack/react-query";
import type { Scan } from "@/types";
import { 
  fetchReports, 
  fetchCompletedScansForReports,
  fetchReport
} from "@/Services/Reports";

export function useReports() {
  const query = useQuery({
    queryKey: ["reports"],
    queryFn: fetchReports,
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

export function useCompletedScansForReports() {
  const query = useQuery<Scan[]>({
    queryKey: ["scans", "completed-for-report"],
    queryFn: fetchCompletedScansForReports,
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

export function useReport(id: string) {
  const query = useQuery({
    queryKey: ["reports", id],
    queryFn: () => fetchReport(id),
    enabled: !!id,
  });

  return {
    item: query.data ?? null,
    isPending: query.isPending,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

"use client";

import { useQuery } from "@tanstack/react-query";
import type { ScanFinding, PaginatedResponse, Severity } from "@/types";
import { fetchFindings } from "@/Services/Findings";

export interface FindingsResponse extends PaginatedResponse<ScanFinding & { 
  scan?: { 
    id: string; 
    type?: string; 
    asset?: { id: string; name: string; value: string } 
  } 
}> {
  severityCounts?: { CRITICAL: number; HIGH: number; MEDIUM: number; LOW: number };
  categoryCounts?: { category: string; count: number }[];
}

export function useFindings(params: {
  page?: number;
  limit?: number;
  severity?: Severity | "ALL";
  category?: string | "ALL";
  search?: string;
}) {
  const query = useQuery<FindingsResponse>({
    queryKey: ["findings", params],
    queryFn: () => fetchFindings(params),
  });

  const items = query.data?.data ?? [];
  const total = query.data?.total ?? 0;
  const isEmpty = !query.isPending && !query.isError && items.length === 0;
  const severityCounts = query.data?.severityCounts ?? { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
  const categoryCounts = query.data?.categoryCounts ?? [];

  return {
    items,
    total,
    severityCounts,
    categoryCounts,
    isPending: query.isPending,
    isError: query.isError,
    error: query.error,
    isEmpty,
    refetch: query.refetch,
  };
}

export function useFindingsStats() {
  const { items, total, isPending, severityCounts } = useFindings({ limit: 1 });
  return {
    severityCounts,
    total,
    isPending,
  };
}

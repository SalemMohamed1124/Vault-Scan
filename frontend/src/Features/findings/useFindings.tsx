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
  return useQuery<FindingsResponse>({
    queryKey: ["findings", params],
    queryFn: () => fetchFindings(params),
  });
}

export function useFindingsStats() {
  const { data } = useFindings({ limit: 1 });
  return {
    data: data ? {
      severityCounts: data.severityCounts || { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 },
      total: data.total
    } : null,
    isPending: !data
  };
}

"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { ScanFinding, PaginatedResponse, Severity } from "@/types";
import { fetchFindings, deleteFinding, deleteFindings } from "@/Services/Findings";

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

export function useDeleteFindings() {
  const queryClient = useQueryClient();

  const deleteOne = useMutation({
    mutationFn: deleteFinding,
    onSuccess: () => {
      toast.success("Finding deleted successfully");
      queryClient.invalidateQueries({ queryKey: ["findings"] });
    },
    onError: () => toast.error("Failed to delete finding"),
  });

  const deleteMany = useMutation({
    mutationFn: deleteFindings,
    onSuccess: () => {
      toast.success("Batch deletion completed");
      queryClient.invalidateQueries({ queryKey: ["findings"] });
    },
    onError: () => toast.error("Failed to delete findings"),
  });

  return { deleteOne, deleteMany };
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

"use client";

import { useQuery } from "@tanstack/react-query";
import type { Scan } from "@/types";
import { 
  fetchReports, 
  fetchCompletedScansForReports 
} from "@/Services/Reports";

export function useReports() {
  const {
    data: reports,
    isPending,
    error,
  } = useQuery({
    queryKey: ["reports"],
    queryFn: fetchReports,
  });

  return { reports, isPending, error };
}

export function useCompletedScansForReports() {
  const {
    data: scans,
    isPending,
    error,
  } = useQuery<Scan[]>({
    queryKey: ["scans", "completed-for-report"],
    queryFn: fetchCompletedScansForReports,
  });

  return { scans, isPending, error };
}

"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import type { Scan, ScanFinding } from "@/types";
import { 
  fetchScan, 
  fetchScanFindings, 
  deleteScan as deleteScanApiReq, 
  createScanReport 
} from "@/Services/Scans";
import type { AxiosError } from "axios";

export function useScanResults(id: string) {
  const queryClient = useQueryClient();
  const router = useRouter();

  // ─── Scan Data Query ────────────────────────────────
  const { data: scan, isPending: scanPending, error: scanError } = useQuery<Scan | null>({
    queryKey: ["scan", id],
    queryFn: () => fetchScan(id).catch(() => null),
    refetchInterval: (query) => {
      const s = query.state.data;
      if (s && (s.status === "RUNNING" || s.status === "PENDING")) return 5000;
      return false;
    },
  });

  // ─── Findings Query ─────────────────────────────────
  const { data: findings = [], isPending: findingsPending } = useQuery<ScanFinding[]>({
    queryKey: ["scan-findings", id],
    queryFn: () => fetchScanFindings(id).catch(() => []),
    enabled: !!scan && scan.status === "COMPLETED",
  });

  // ─── Report Mutation ────────────────────────────────
  const generateReport = useMutation({
    mutationFn: () => createScanReport(id),
    onSuccess: () => {
      toast.success("Report generation started");
      queryClient.invalidateQueries({ queryKey: ["reports"] });
    },
    onError: () => toast.error("Failed to generate report"),
  });

  // ─── Delete Mutation ────────────────────────────────
  const deleteScan = useMutation({
    mutationFn: () => deleteScanApiReq(id),
    onSuccess: () => {
      toast.success("Scan deleted");
      queryClient.invalidateQueries({ queryKey: ["scans"] });
      router.push("/scans");
    },
    onError: (err: AxiosError<{ message: string }>) => {
      const msg = err?.response?.data?.message || "Failed to delete scan";
      toast.error(msg);
    },
  });

  return {
    scan,
    findings,
    loading: {
      scan: scanPending,
      findings: findingsPending,
    },
    error: scanError,
    actions: {
      generateReport: () => generateReport.mutate(),
      isGeneratingReport: generateReport.isPending,
      deleteScan: () => deleteScan.mutate(),
      isDeleting: deleteScan.isPending,
      refresh: () => queryClient.invalidateQueries({ queryKey: ["scan", id] }),
    },
  };
}

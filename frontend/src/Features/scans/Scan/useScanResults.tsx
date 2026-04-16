"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useScan, useScanFindings } from "@/Features/scans/useScans";
import { useDeleteScan } from "@/Features/scans/useScanMutations";
import { useGenerateReport } from "@/Features/reports/useReportMutations";

export function useScanResults(id: string) {
  const queryClient = useQueryClient();
  const router = useRouter();

  const { scan, isPending: scanPending, error: scanError } = useScan(id);

  // Automatically fetch fresh findings and AI data when a pending scan finishes
  useEffect(() => {
    if (scan?.status === "COMPLETED" || scan?.status === "FAILED") {
      queryClient.invalidateQueries({ queryKey: ["scan-findings", id] });
      queryClient.invalidateQueries({ queryKey: ["scan-raw", id] });
      queryClient.invalidateQueries({ queryKey: ["ai-analysis", id] });
    }
  }, [scan?.status, id, queryClient]);

  const { items: findings = [], isPending: findingsPending } = useScanFindings(id);

  const generateReport = useGenerateReport();

  const deleteScan = useDeleteScan();

  const handleDelete = async () => {
    await deleteScan.mutateAsync(id);
    router.push("/scans");
  };

  return {
    scan,
    findings,
    loading: {
      scan: scanPending,
      findings: findingsPending,
    },
    error: scanError,
    actions: {
      generateReport: () => generateReport.mutate({ scanId: id, format: "pdf" }),
      isGeneratingReport: generateReport.isPending,
      deleteScan: handleDelete,
      isDeleting: deleteScan.isPending,
      refresh: () => queryClient.invalidateQueries({ queryKey: ["scan", id] }),
    },
  };
}

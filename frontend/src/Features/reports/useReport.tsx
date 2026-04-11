"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { 
  fetchReport, 
  generateReport, 
  downloadReportFile 
} from "@/Services/Reports";
import type { Report } from "@/types";

export default function useReport(id?: string) {
  const queryClient = useQueryClient();

  const {
    data: report,
    isPending,
    error,
  } = useQuery({
    queryKey: ["reports", id],
    queryFn: () => fetchReport(id!),
    enabled: !!id,
  });

  const {
    isPending: isGenerating,
    mutateAsync: generateReportApi,
    error: generateError,
  } = useMutation({
    mutationFn: generateReport,
    onSuccess: () => {
      toast.success("Report generated successfully");
      queryClient.invalidateQueries({ queryKey: ["reports"] });
    },
    onError: () => {
      toast.error("Failed to generate report");
    },
  });

  const downloadReportApi = async (report: Report) => {
    try {
      await downloadReportFile(report.id, report.format);
    } catch {
      toast.error("Failed to download report");
    }
  };

  return {
    report,
    isPending,
    error,
    isGenerating,
    generateReportApi,
    generateError,
    downloadReportApi,
  };
}

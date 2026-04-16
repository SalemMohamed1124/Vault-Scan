"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { generateReport, downloadReportFile } from "@/Services/Reports";
import type { Report } from "@/types";

export function useGenerateReport() {
  const queryClient = useQueryClient();
  const pathname = usePathname();

  const mutation = useMutation({
    mutationFn: generateReport,
    onSuccess: () => {
      const isReportsPage = pathname === "/reports";

      toast.success("Report generated successfully", {
        action: !isReportsPage ? (
          <Link
            href="/reports"
            className="text-primary font-bold hover:underline text-xs mr-2 transition-all"
          >
            View reports
          </Link>
        ) : undefined,
      });

      queryClient.invalidateQueries({ queryKey: ["reports"] });
    },
    onError: () => {
      toast.error("Failed to generate report");
    },
  });

  return {
    mutate: mutation.mutate,
    mutateAsync: mutation.mutateAsync,
    isPending: mutation.isPending,
    isError: mutation.isError,
    error: mutation.error,
  };
}

export function useDownloadReport() {
  const downloadReportApi = async (report: Report) => {
    try {
      await downloadReportFile(report.id, report.format);
    } catch {
      toast.error("Failed to download report");
    }
  };

  return { downloadReportApi };
}

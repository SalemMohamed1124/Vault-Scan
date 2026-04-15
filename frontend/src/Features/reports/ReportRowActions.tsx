"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Download, Copy, Loader2, Fingerprint } from "lucide-react";
import { useState } from "react";
import type { Report } from "@/types";
import { useSidebar } from "@/components/ui/sidebar";
import { useDownloadReport } from "./useReportMutations";
import { toast } from "sonner";

const toClipboard = (text: string, message?: string) => {
  navigator.clipboard.writeText(text);
  if (message) toast.success(message);
};

type ReportRowActionsProps = {
  report: Report;
};

export default function ReportRowActions({ report }: ReportRowActionsProps) {
  const { isMobile } = useSidebar();
  const { downloadReportApi } = useDownloadReport();
  const [isDownloading, setIsDownloading] = useState(false);
  
  const isExpired = new Date(report.expiresAt) < new Date();

  const handleDownload = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (isExpired) {
        toast.error("This report has expired and can no longer be downloaded.");
        return;
    }
    setIsDownloading(true);
    await downloadReportApi(report);
    setIsDownloading(false);
  };

  if (isMobile) {
    return (
      <div className="grid grid-cols-2 gap-2 w-full">
        <Button 
          variant="outline" 
          onClick={handleDownload} 
          disabled={isDownloading || isExpired}
          className="w-full text-xs h-9 gap-1.5"
        >
          {isDownloading ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Download className="size-3.5" />
          )}
          Download
        </Button>
        <Button 
          variant="outline" 
          onClick={() => toClipboard(report.id, "Report ID copied")} 
          className="w-full text-xs h-9 gap-1.5"
        >
          <Fingerprint className="size-3.5" />
          Copy ID
        </Button>
        <Button 
          variant="outline" 
          onClick={() => toClipboard(report.scanId, "Scan ID copied")} 
          className="w-full text-xs h-9 gap-1.5 col-span-2"
        >
          <Copy className="size-3.5" />
          Copy Scan ID
        </Button>

      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-8 w-8 p-0 hover:bg-muted/50 rounded-full transition-all">
          <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel className="text-xs font-bold px-3 py-2">Report Actions</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem 
          onClick={handleDownload} 
          disabled={isDownloading || isExpired}
          className="cursor-pointer gap-2 px-3 py-2 text-xs font-semibold"
        >
          {isDownloading ? (
            <Loader2 className="size-3.5 animate-spin text-primary" />
          ) : (
            <Download className="size-3.5 text-primary" />
          )}
          Download {report.format}
        </DropdownMenuItem>
        
        <DropdownMenuItem 
          onClick={() => toClipboard(report.id, "Report ID copied to clipboard")}
          className="cursor-pointer gap-2 px-3 py-2 text-xs font-medium"
        >
          <Copy className="size-3.5 text-muted-foreground/70" />
          Copy Report ID
        </DropdownMenuItem>

        <DropdownMenuItem 
          onClick={() => toClipboard(report.scanId, "Scan ID copied to clipboard")}
          className="cursor-pointer gap-2 px-3 py-2 text-xs font-medium"
        >
          <Fingerprint className="size-3.5 text-muted-foreground/70" />
          Copy Scan ID
        </DropdownMenuItem>

      
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

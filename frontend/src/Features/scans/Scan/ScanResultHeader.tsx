"use client";

import { cn, formatDuration, formatRelativeTime } from "@/lib/utils";
import { 
  CheckCircle2, 
  Loader2, 
  XCircle, 
  Ban, 
  Layers, 
  Zap, 
  Globe, 
  Play, 
  Timer, 
  Activity,
  FileText,
  Trash2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScanStatusBadge } from "./ScanStatusBadge";
import { ScanProgress } from "./ScanProgress";
import { CancelScanButton } from "./CancelScanButton";
import type { Scan, ScanStatus } from "@/types";

import { Spinner } from "@/components/ui/spinner";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useConfirm } from "@/Contexts/ConfirmModalContext";

const statusIcon: Record<ScanStatus, React.ReactNode> = {
  PENDING: <CheckCircle2 className="size-5" />,
  RUNNING: <Loader2 className="size-5 animate-spin" />,
  COMPLETED: <CheckCircle2 className="size-5" />,
  FAILED: <XCircle className="size-5" />,
  CANCELLED: <Ban className="size-5" />,
};

interface ScanResultHeaderProps {
  scan: Scan;
  onGenerateReport: () => void;
  isGeneratingReport: boolean;
  onDelete: () => Promise<void>;
  isDeleting: boolean;
  onRefresh: () => void;
}

export function ScanResultHeader({ 
  scan, 
  onGenerateReport, 
  isGeneratingReport,
  onDelete,
  isDeleting,
  onRefresh
}: ScanResultHeaderProps) {
  const { confirm } = useConfirm();

  const isActive = scan.status === "RUNNING" || scan.status === "PENDING";
  const isCompleted = scan.status === "COMPLETED";

  return (
    <div className="flex flex-col gap-4">
      {/* Back Button Container */}
      <div className="flex items-center gap-3">
        <Link
          href="/scans"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-4" />
        </Link>
      </div>

      <div className="px-1 py-2 sm:px-2">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex flex-col sm:flex-row items-start gap-4">
            {/* Status Type Icon */}
            <div
              className={cn(
                "h-14 w-14 shrink-0 items-center justify-center rounded-xl border transition-colors hidden sm:flex shadow-sm",
                scan.status === "COMPLETED" && "bg-green-500/10 border-green-500/20 text-green-600",
                scan.status === "RUNNING" && "bg-blue-500/10 border-blue-500/20 text-blue-600",
                scan.status === "PENDING" && "bg-slate-500/10 border-slate-500/20 text-slate-600",
                scan.status === "FAILED" && "bg-red-500/10 border-red-500/20 text-red-600",
                scan.status === "CANCELLED" && "bg-slate-600/10 border-slate-600/20 text-slate-500",
              )}
            >
               {statusIcon[scan.status]}
            </div>

            <div className="min-w-0 flex-1 w-full flex flex-col justify-center pt-0.5">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-colors sm:hidden",
                      scan.status === "COMPLETED" && "bg-green-500/5 border-green-500/10 text-green-500",
                      scan.status === "RUNNING" && "bg-blue-500/5 border-blue-500/10 text-blue-500",
                      scan.status === "PENDING" && "bg-slate-500/5 border-slate-500/10 text-slate-500",
                      scan.status === "FAILED" && "bg-red-500/5 border-red-500/10 text-red-500",
                      scan.status === "CANCELLED" && "bg-slate-600/5 border-slate-600/10 text-slate-500",
                    )}
                  >
                    {statusIcon[scan.status]}
                  </div>
                  <h1 className="text-xl sm:text-2xl font-black tracking-tight text-foreground truncate">
                    {scan.asset?.name ?? "Scan Results"}
                  </h1>
                </div>
                <div className="flex items-center gap-2 mt-1 sm:mt-0">
                  <ScanStatusBadge status={scan.status} />
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-black uppercase tracking-widest",
                      scan.type === "DEEP"
                        ? "bg-primary/10 text-primary"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {scan.type === "DEEP" ? <Layers className="size-3.5" /> : <Zap className="size-3.5" />}
                    {scan.type}
                  </span>
                </div>
              </div>

              {scan.asset?.value && (
                <p className="mt-1.5 text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                  <Globe className="size-4 opacity-70" />
                  {scan.asset.value}
                </p>
              )}

              {/* Consolidated Runtime Info */}
              <div className="mt-3.5 flex flex-wrap items-center gap-3 text-[13px] font-bold text-muted-foreground/60 uppercase tracking-widest">
                {scan.status === "RUNNING" ? (
                  <span className="flex items-center gap-1 text-blue-500/80">
                    <Activity className="size-4 animate-pulse" />
                    IN PROGRESS
                  </span>
                ) : scan.startedAt && scan.completedAt ? (
                  <span className="flex items-center gap-1.5">
                    <Timer className="size-4" />
                    SCANNED IN {formatDuration(scan.startedAt, scan.completedAt)}
                    <span className="opacity-30 mx-1">•</span>
                    COMPLETED {formatRelativeTime(scan.completedAt)}
                  </span>
                ) : scan.startedAt ? (
                  <span className="flex items-center gap-1.5">
                    <Play className="size-4" />
                    STARTED {formatRelativeTime(scan.startedAt)}
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 shrink-0 pt-2 lg:pt-0">
            {isActive && (
              <CancelScanButton
                scanId={scan.id}
                onCancelled={onRefresh}
              />
            )}
            {isCompleted && (
              <Button
                variant="outline"
                onClick={onGenerateReport}
                disabled={isGeneratingReport}
                className="h-11 rounded-none px-6 text-[13px] font-bold gap-2 text-muted-foreground hover:text-foreground"
              >
                {isGeneratingReport ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <FileText className="size-4" />
                )}
                Generate Report
              </Button>
            )}
            {!isActive && (
              <Button
                variant="outline"
                onClick={() => {
                  confirm({
                    title: "Delete Scan",
                    description: "Are you sure you want to delete this scan? This action cannot be undone.",
                    variant: "danger",
                    confirmText: "Delete",
                    onConfirm: onDelete,
                  });
                }}
                disabled={isDeleting}
                className="h-11 rounded-none px-6 text-[13px] font-bold gap-2 text-muted-foreground hover:text-destructive hover:bg-destructive/5 hover:border-destructive/50 transition-all"
                aria-label="Delete scan"
              >
                {isDeleting ? (
                  <Spinner className="size-4" />
                ) : (
                  <Trash2 className="size-4" />
                )}
                Delete Scan
              </Button>
            )}
          </div>
        </div>

        {scan.status === "RUNNING" && (
          <div className="mt-6 border-t border-border/50 pt-5">
            <ScanProgress
              scanId={scan.id}
              onComplete={onRefresh}
            />
          </div>
        )}
      </div>
    </div>
  );
}

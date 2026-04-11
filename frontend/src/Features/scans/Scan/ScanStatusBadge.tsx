"use client";

import { cn } from "@/lib/utils";
import type { ScanStatus } from "@/types";

const statusStyles: Record<ScanStatus, string> = {
  PENDING: "bg-slate-500/20 text-slate-400 border-slate-500/30",
  RUNNING: "bg-blue-500/20 text-blue-400 border-blue-500/30 animate-pulse",
  COMPLETED: "bg-primary/20 text-primary border-primary/30",
  CANCELLED: "bg-slate-600/20 text-slate-500 border-slate-600/30",
  FAILED: "bg-red-500/20 text-red-400 border-red-500/30",
};

export function ScanStatusBadge({ status }: { status: ScanStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        statusStyles[status],
      )}
    >
      {status === "RUNNING" && (
        <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse" />
      )}
      {status}
    </span>
  );
}

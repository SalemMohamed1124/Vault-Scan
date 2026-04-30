"use client";

import { cn } from "@/lib/utils";
import type { ScanStatus } from "@/types";
import { SCAN_STATUS_CONFIG } from "../scan-status-config";
import { SeverityBadge } from "@/components/layout/SeverityBadge";

export function ScanStatusBadge({ status }: { status: ScanStatus }) {
  const config = SCAN_STATUS_CONFIG[status];
  const Icon = config.icon;

  return (
    <SeverityBadge theme={config.theme} className="gap-1.5">
      <Icon className={cn("size-3", status === "RUNNING" && "animate-spin")} />
      <span className="text-xs">{config.label}</span>
    </SeverityBadge>
  );
}

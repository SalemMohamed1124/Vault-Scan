"use client";

import type { Scan, ScanStatus } from "@/types";
import { MobileCard } from "@/components/layout/MobileCard";
import { SeverityBadge } from "@/components/layout/SeverityBadge";
import { formatRelativeTime, formatDuration, severityDot } from "@/lib/utils";
import {
  Play,
  CheckCircle2,
  Loader2,
  XCircle,
  Clock,
  Ban,
  Calendar,
  Timer,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import ScanRowActions from "./ScanRowActions";

import { SCAN_STATUS_CONFIG } from "./scan-status-config";

export default function ScanMobileCard({ scan }: { scan: Scan }) {
  const status = scan.status;
  const config = SCAN_STATUS_CONFIG[status];
  const Icon = config.icon;
  const summary = scan.findingsSummary;

  return (
    <MobileCard className="w-full max-w-full">
      <MobileCard.Header>
        <div className="grid min-w-0 flex-1 gap-1">
          <h4
            className="font-bold text-lg tracking-tight leading-none truncate w-full"
            title={scan.asset?.name || scan.assetId}
          >
            {scan.asset?.name || "Target Asset"}
          </h4>
          <div className="flex min-w-0">
            <span className="truncate max-w-full px-2 py-0.5 bg-muted/40 border border-border/50 text-[10px] font-mono text-muted-foreground rounded-sm">
              {scan.asset?.value || scan.assetId}
            </span>
          </div>
        </div>
        <EnhancedStatusBadge status={status} />
      </MobileCard.Header>

      <MobileCard.Content>
        {/* Scan Progress (if running) */}
        {status === "RUNNING" && (
          <div className="px-1 mb-2">
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-[10px] font-black uppercase tracking-widest text-primary/70">
                Scanning Progress
              </span>
              <span className="text-[10px] font-black text-primary">
                {scan.progress || 0}%
              </span>
            </div>
            <div className="h-1 w-full rounded-full bg-primary/10 overflow-hidden border border-primary/5">
              <div
                className="h-full bg-primary transition-all duration-500"
                style={{ width: `${Math.max(5, scan.progress || 0)}%` }}
              />
            </div>
          </div>
        )}

        <MobileCard.Row>
          <span className="text-xs text-muted-foreground font-medium shrink-0">
            Scan Type:
          </span>
          <span className="text-xs font-bold px-1.5 py-0.5 bg-secondary/30 border border-border/30 rounded-none uppercase tracking-tighter text-[10px]">
            {scan.type} SCAN
          </span>
        </MobileCard.Row>

        <MobileCard.Row>
          <span className="text-xs text-muted-foreground font-medium shrink-0">
            Started:
          </span>
          <div className="flex items-center gap-1.5 min-w-0">
            <Calendar className="size-3.5 text-muted-foreground/60 shrink-0" />
            <span className="text-xs font-bold truncate">
              {formatRelativeTime(scan.startedAt)}
            </span>
          </div>
        </MobileCard.Row>

        <MobileCard.Row>
          <span className="text-xs text-muted-foreground font-medium shrink-0">
            Duration:
          </span>
          <div className="flex items-center gap-1.5 min-w-0">
            <Timer className="size-3.5 text-muted-foreground/60 shrink-0" />
            <span className="text-xs font-bold truncate">
              {scan.startedAt && scan.completedAt
                ? formatDuration(scan.startedAt, scan.completedAt)
                : "--"}
            </span>
          </div>
        </MobileCard.Row>

        {summary && summary.total > 0 && (
          <MobileCard.Row>
            <span className="text-xs text-muted-foreground font-medium shrink-0">
              Findings:
            </span>
            <div className="flex items-center gap-2">
              {[
                { count: summary.critical, color: "bg-red-500" },
                { count: summary.high, color: "bg-orange-500" },
                { count: summary.medium, color: "bg-amber-500" },
                { count: summary.low, color: "bg-blue-500" },
              ].map(
                (s, idx) =>
                  s.count > 0 && (
                    <div key={idx} className="flex items-center gap-1 shrink-0">
                      <div className={cn("size-2 rounded-full", s.color)} />
                      <span className="text-xs font-bold">{s.count}</span>
                    </div>
                  ),
              )}
            </div>
          </MobileCard.Row>
        )}
      </MobileCard.Content>

      <MobileCard.Footer>
        <ScanRowActions scan={scan} />
      </MobileCard.Footer>
    </MobileCard>
  );
}

function EnhancedStatusBadge({ status }: { status: ScanStatus }) {
  const config = SCAN_STATUS_CONFIG[status];
  const Icon = config.icon;
  return (
    <SeverityBadge
      theme={config.theme}
      className="gap-1.5 font-black uppercase text-[9px] tracking-tight py-1 px-2.5 shrink-0"
    >
      <Icon className={cn("size-3", status === "RUNNING" && "animate-spin")} />
      {config.label}
    </SeverityBadge>
  );
}



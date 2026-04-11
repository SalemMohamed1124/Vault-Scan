"use client";

import { cn } from "@/lib/utils";
import type { FindingsSummary as SummaryType } from "@/types";
import { Summary } from "@/components/layout/Summary";
import { ShieldAlert, AlertTriangle, Info, Shield } from "lucide-react";

interface FindingsSummaryProps {
  summary: SummaryType;
  groupBySeverity: boolean;
  onToggleGroupBySeverity: () => void;
}

export function FindingsSummary({
  summary,
  groupBySeverity,
  onToggleGroupBySeverity,
}: {
  summary: SummaryType;
  groupBySeverity: boolean;
  onToggleGroupBySeverity: () => void;
}) {
  const severityDistribution = [
    {
      label: "Critical",
      count: summary.critical,
      dot: "bg-red-500",
      color: "text-red-500",
    },
    {
      label: "High",
      count: summary.high,
      dot: "bg-orange-500",
      color: "text-orange-500",
    },
    {
      label: "Medium",
      count: summary.medium,
      dot: "bg-amber-500",
      color: "text-amber-500",
    },
    {
      label: "Low",
      count: summary.low,
      dot: "bg-blue-500",
      color: "text-blue-500",
    },
  ];

  const total = summary.total || 1; // Avoid division by zero

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="glass-card rounded-3xl p-5 sm:p-6 border border-border/40 bg-muted/5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="space-y-1">
            <h3 className="text-[13px] font-black text-muted-foreground uppercase tracking-[0.2em] opacity-80 flex items-center gap-2">
              <span className="size-2 rounded-full bg-primary animate-pulse" />
              Impact Analysis
            </h3>
            <p className="text-sm font-bold text-foreground/90">
              Vulnerability Distribution{" "}
              <span className="text-muted-foreground/40 font-medium ml-1">
                ({summary.total} total)
              </span>
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onToggleGroupBySeverity}
              className={cn(
                "text-xs font-black uppercase tracking-widest px-6 py-2.5 rounded-none border transition-all shadow-sm",
                groupBySeverity
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background border-border text-muted-foreground hover:text-foreground hover:bg-muted",
              )}
            >
              {groupBySeverity ? "Ungrouped" : "Group by Severity"}
            </button>
          </div>
        </div>

        {/* Scaled Distribution Bar */}
        <div className="relative group">
          <div className="flex h-4 overflow-hidden rounded-full bg-muted/40 border border-border/10 shadow-inner p-0.5">
            {severityDistribution.map((s) =>
              s.count > 0 ? (
                <div
                  key={s.label}
                  className={cn(
                    "h-full first:rounded-l-full last:rounded-r-full transition-all duration-700 ease-in-out",
                    s.dot,
                  )}
                  style={{
                    width: `${(s.count / total) * 100}%`,
                  }}
                />
              ) : null,
            )}
          </div>

          {/* Legend / Stats Grid using Reusable Summary Component */}
          <div className="mt-6">
            <Summary data={[]}>
              <Summary.Card
                label="Critical"
                variant="critical"
                icon={<ShieldAlert className="size-4" />}
                counts={summary.critical}
                sublabel="Impact"
                className="rounded-xl border-l-4"
              />
              <Summary.Card
                label="High"
                variant="high"
                icon={<AlertTriangle className="size-4" />}
                counts={summary.high}
                sublabel="Impact"
                className="rounded-xl border-l-4"
              />
              <Summary.Card
                label="Medium"
                variant="medium"
                icon={<Info className="size-4" />}
                counts={summary.medium}
                sublabel="Impact"
                className="rounded-xl border-l-4"
              />
              <Summary.Card
                label="Low"
                variant="low"
                icon={<Shield className="size-4" />}
                counts={summary.low}
                sublabel="Impact"
                className="rounded-xl border-l-4"
              />
            </Summary>
          </div>
        </div>
      </div>
    </div>
  );
}


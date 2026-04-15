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
}: FindingsSummaryProps) {
  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-1">
        <div className="flex flex-col">
          <h3 className="text-[11px] font-black text-muted-foreground uppercase tracking-[0.2em] opacity-80">
            Impact Analysis
          </h3>
          <p className="text-sm font-bold text-foreground/90">
            Vulnerability Distribution{" "}
            <span className="text-muted-foreground/40 font-medium ml-1">
              ({summary.total} findings)
            </span>
          </p>
        </div>

        <button
          onClick={onToggleGroupBySeverity}
          className={cn(
            "text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-none border transition-all shadow-sm h-fit",
            groupBySeverity
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-background border-border text-muted-foreground hover:text-foreground hover:bg-muted"
          )}
        >
          {groupBySeverity ? "Ungroup" : "Group by Severity"}
        </button>
      </div>

      <Summary data={[]}>
        <Summary.Card
          label="Critical"
          variant="critical"
          icon={<ShieldAlert className="size-4" />}
          counts={summary.critical}
          sublabel="Impact"
          className="rounded-none border-l-2"
        />
        <Summary.Card
          label="High"
          variant="high"
          icon={<AlertTriangle className="size-4" />}
          counts={summary.high}
          sublabel="Impact"
          className="rounded-none border-l-2"
        />
        <Summary.Card
          label="Medium"
          variant="medium"
          icon={<Info className="size-4" />}
          counts={summary.medium}
          sublabel="Impact"
          className="rounded-none border-l-2"
        />
        <Summary.Card
          label="Low"
          variant="low"
          icon={<Shield className="size-4" />}
          counts={summary.low}
          sublabel="Impact"
          className="rounded-none border-l-2"
        />
      </Summary>
    </div>
  );
}


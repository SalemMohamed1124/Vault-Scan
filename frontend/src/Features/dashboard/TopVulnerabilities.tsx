"use client";

import { useTopVulns } from "./useDashboardData";
import { Target, Bug } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { SeverityBadge } from "@/components/layout/SeverityBadge";
import { cn } from "@/lib/utils";

export default function TopVulnerabilities() {
  const { data: vulns, isLoading } = useTopVulns();

  if (isLoading) return <Skeleton className="h-[400px]" />;

  const maxCount = Math.max(...(vulns?.map((v) => v.count) || [1]), 1);

  return (
    <div className="glass-card p-5 flex flex-col gap-5 shadow-none">
      <div className="flex items-center gap-2">
        <div className="size-8 bg-amber-500/10 flex items-center justify-center text-amber-500 border border-amber-500/10">
          <Target className="size-4" />
        </div>
        <div className="flex flex-col">
          <h3 className="text-sm font-black uppercase tracking-tight">
            Top Threats
          </h3>
        </div>
      </div>

      <div className="flex flex-col gap-5">
        {vulns && vulns.length > 0 ? (
          vulns.map((v, idx) => (
            <div key={idx} className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <Bug className="size-3 text-red-500/70" />
                  <span className="text-[11px] font-bold truncate max-w-[200px]">
                    {v.name}
                  </span>
                </div>
                <SeverityBadge
                  theme={v.severity.toLowerCase()}
                  className="text-[9px] font-black tracking-tighter px-2"
                >
                  {v.severity.slice(0, 1)}
                </SeverityBadge>
              </div>
              <div className="relative h-2 w-full bg-muted/30 overflow-hidden border border-border/20">
                <div
                  className={cn(
                    "h-full",
                    v.severity === "CRITICAL"
                      ? "bg-red-500 border-r-2 border-red-400"
                      : "bg-primary",
                  )}
                  style={{ width: `${(v.count / maxCount) * 100}%` }}
                />
              </div>
              <div className="flex items-center justify-between px-1">
                <span className="text-[9px] font-black text-muted-foreground uppercase opacity-50">
                  {v.category}
                </span>
                <span className="text-[10px] font-black text-foreground">
                  {v.count} INCIDENTS
                </span>
              </div>
            </div>
          ))
        ) : (
          <div className="py-20 flex flex-col items-center justify-center opacity-30">
            <p className="text-[10px] font-black uppercase tracking-widest">
              No Registered Threats
            </p>
          </div>
        )}
      </div>
    </div>
  );
}



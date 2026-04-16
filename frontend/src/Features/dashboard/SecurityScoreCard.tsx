"use client";

import { useSecurityScore } from "./useDashboardData";
import { Shield, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { SeverityBadge } from "@/components/layout/SeverityBadge";

export default function SecurityScoreCard() {
  const { score, isPending } = useSecurityScore();

  if (isPending) {
    return (
      <div className="glass-card p-5 h-full animate-pulse">
        <div className="flex flex-col gap-4">
          <div className="h-3 w-20 bg-muted/20 rounded pl-1" />
          <div className="flex items-center gap-4">
            <div className="size-14 rounded-full bg-muted/10" />
            <div className="space-y-2">
              <div className="h-6 w-20 bg-muted/20 rounded" />
              <div className="h-3 w-12 bg-muted/10 rounded" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  const s = score || { score: 0, grade: "F", previousScore: 0, trend: "stable" };
  const diff = s.score - s.previousScore;

  const config = {
    A: { color: "#10b981", theme: "success" },
    B: { color: "#3b82f6", theme: "low" },
    C: { color: "#f59e0b", theme: "medium" },
    D: { color: "#f97316", theme: "high" },
  }[s.grade] || { color: "#ef4444", theme: "critical" };

  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (s.score / 100) * circumference;

  return (
    <div className="glass-card p-6 h-full flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-6">
          <span className="font-mono text-[10px] font-bold tracking-[0.2em] text-muted-foreground uppercase opacity-80">
            Security Score
          </span>
          <div className="text-muted-foreground opacity-50">
            <Shield className="size-5" />
          </div>
        </div>
        
        <div className="flex items-center gap-6">
          <div className="relative size-16 flex items-center justify-center -rotate-90 shrink-0">
            <svg className="size-full">
              <circle cx="32" cy="32" r={radius} fill="none" stroke="currentColor" strokeWidth="4" className="text-muted/10" />
              <circle 
                cx="32" cy="32" r={radius} fill="none" stroke={config.color} strokeWidth="4" 
                strokeDasharray={circumference} strokeDashoffset={offset}
                strokeLinecap="round"
                className="transition-all duration-1000 ease-out"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center rotate-90 font-black text-xl">{s.score}</span>
          </div>

          <div className="flex flex-col gap-2">
            <SeverityBadge theme={config.theme as any} className="font-black uppercase tracking-widest text-[10px]">
              Grade {s.grade}
            </SeverityBadge>
            <div className={cn(
              "flex items-center gap-1 text-[11px] font-bold",
              s.trend === 'up' ? "text-emerald-500" : s.trend === 'down' ? "text-red-500" : "text-muted-foreground"
            )}>
              {s.trend === 'up' ? <ArrowUpRight className="size-3.5" /> : s.trend === 'down' ? <ArrowDownRight className="size-3.5" /> : null}
              {diff > 0 ? `+${diff}` : diff} PTS
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

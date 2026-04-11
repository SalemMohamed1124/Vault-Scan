"use client";

import { useSecurityScore } from "./useDashboardData";
import { Shield, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

export default function SecurityScoreCard() {
  const { data, isLoading } = useSecurityScore();

  if (isLoading) return <Skeleton className="h-[120px]" />;

  const s = data || { score: 0, grade: "F", previousScore: 0, trend: "stable" };
  const diff = s.score - s.previousScore;

  const getRingColor = (grade: string) => {
    switch (grade) {
      case "A": return "#10b981";
      case "B": return "#3b82f6";
      case "C": return "#f59e0b";
      case "D": return "#f97316";
      default: return "#ef4444";
    }
  };

  const getBadgeClass = (grade: string) => {
    switch (grade) {
      case "A": return "bg-emerald-500/10 text-emerald-500 border-emerald-500/20";
      case "B": return "bg-blue-500/10 text-blue-500 border-blue-500/20";
      case "C": return "bg-amber-500/10 text-amber-500 border-amber-500/20";
      default: return "bg-red-500/10 text-red-500 border-red-500/20";
    }
  };

  const radius = 24;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (s.score / 100) * circumference;

  return (
    <div className="relative glass-card p-4 sm:p-5 gradient-card-green h-full">
      <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
        <div className="flex flex-col gap-3 w-full min-w-0">
          <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest pl-1 truncate">Security Score</p>
          <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
            <div className="relative size-14 flex items-center justify-center -rotate-90 shrink-0">
               <svg className="size-full">
                  <circle cx="28" cy="28" r={radius} fill="none" stroke="currentColor" strokeWidth="4" className="text-muted/10" />
                  <circle 
                    cx="28" cy="28" r={radius} fill="none" stroke={getRingColor(s.grade)} strokeWidth="4" 
                    strokeDasharray={circumference} strokeDashoffset={offset}
                    className="transition-all duration-1000 ease-out"
                  />
               </svg>
               <span className="absolute inset-0 flex items-center justify-center rotate-90 font-black text-lg">{s.score}</span>
            </div>
            <div className="flex flex-col gap-1.5 min-w-0">
               <div className={cn("px-3 py-1 border font-black text-[10px] sm:text-xs text-center whitespace-nowrap", getBadgeClass(s.grade))}>
                  GRADE {s.grade}
               </div>
               <div className={cn(
                 "flex items-center gap-1 text-[10px] font-bold px-1 whitespace-nowrap",
                 s.trend === 'up' ? "text-emerald-500" : s.trend === 'down' ? "text-red-500" : "text-muted-foreground"
               )}>
                 {s.trend === 'up' ? <ArrowUpRight className="size-3 shrink-0" /> : s.trend === 'down' ? <ArrowDownRight className="size-3 shrink-0" /> : null}
                 <span className="truncate">{diff > 0 ? `+${diff}` : diff} PTS</span>
               </div>
            </div>
          </div>
        </div>
        <div className="hidden sm:flex size-9 bg-emerald-500/10 items-center justify-center text-emerald-500 border border-emerald-500/10 shrink-0 self-start">
           <Shield className="size-5" />
        </div>
        {/* Mobile icon - positioned differently */}
        <div className="sm:hidden absolute top-4 right-4 text-emerald-500/20">
           <Shield className="size-8" />
        </div>
      </div>
    </div>
  );
}

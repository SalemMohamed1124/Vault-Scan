"use client";

import { useRecentActivity } from "./useDashboardData";
import { Zap, CheckCircle2, XCircle, AlertTriangle, Activity, Clock } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, formatRelativeTime } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

const typeConfig: Record<string, { icon: LucideIcon; color: string; bg: string }> = {
  SCAN_COMPLETED: { icon: CheckCircle2, color: "text-emerald-500", bg: "bg-emerald-500/10" },
  SCAN_FAILED: { icon: XCircle, color: "text-red-500", bg: "bg-red-500/10" },
  FINDING_DISCOVERED: { icon: AlertTriangle, color: "text-amber-500", bg: "bg-amber-500/10" },
};
const DEFAULT_CONFIG = { icon: Activity, color: "text-primary", bg: "bg-primary/10" };

export default function RecentActivity() {
  const { data: activity, isLoading } = useRecentActivity();

  if (isLoading) return <Skeleton className="h-[400px]" />;

  return (
    <div className="glass-card p-5 flex flex-col gap-5 border-border/10 shadow-none">
       <div className="flex items-center gap-2">
        <div className="size-8 bg-primary/10 flex items-center justify-center text-primary border border-primary/10">
          <Zap className="size-4" />
        </div>
        <div className="flex flex-col">
          <h3 className="text-sm font-black uppercase tracking-tight">Activity Feed</h3>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {activity && activity.length > 0 ? (
          activity.map((item, idx) => {
            const config = typeConfig[item.type] || DEFAULT_CONFIG;
            const Icon = config.icon;
            return (
              <div key={item.id} className="flex gap-4 relative animate-fade-in-up" style={{ animationDelay: `${idx * 50}ms` }}>
                {idx !== activity.length - 1 && (
                  <div className="absolute left-[15px] top-[34px] bottom-[-20px] w-0.5 bg-border/20" />
                )}
                <div className={cn("size-8 flex items-center justify-center shrink-0 border border-border/10", config.bg, config.color)}>
                  <Icon className="size-4" />
                </div>
                <div className="flex flex-col gap-0.5 pt-0.5 min-w-0">
                   <p className="text-[13px] font-bold text-foreground leading-tight">{item.title}</p>
                   <p className="text-[11px] text-muted-foreground opacity-70 truncate leading-tight">{item.subtitle}</p>
                   <div className="flex items-center gap-1.5 mt-1 text-[9px] font-black uppercase text-muted-foreground tracking-widest">
                     <Clock className="size-3" />
                     {formatRelativeTime(item.timestamp)}
                   </div>
                 </div>
              </div>
            );
          })
        ) : (
          <div className="py-20 flex flex-col items-center justify-center opacity-30">
             <p className="text-[10px] font-black uppercase tracking-widest">No Intelligence Feed</p>
          </div>
        )}
      </div>
    </div>
  );
}

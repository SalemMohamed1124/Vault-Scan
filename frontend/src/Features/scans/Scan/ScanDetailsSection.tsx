"use client";

import { 
  Globe, 
  Hash, 
  User, 
  Building2, 
  Calendar, 
  Shield, 
  Activity,
  Zap,
  Layers,
  Clock,
  Timer
} from "lucide-react";
import { formatDateTime, formatDuration } from "@/lib/utils";
import type { Scan } from "@/types";

interface ScanDetailsSectionProps {
  scan: Scan;
}

export function ScanDetailsSection({ scan }: ScanDetailsSectionProps) {
  const details = [
    { label: "Asset Name", value: scan.asset?.name || "Target", icon: Shield },
    { label: "Asset Value", value: scan.asset?.value || "N/A", icon: Globe },
    { label: "Asset Type", value: scan.asset?.type || "N/A", icon: Layers },
    { label: "Scan ID", value: scan.id.slice(0, 12) + "...", icon: Hash },
    { label: "Organization", value: scan.orgId || "Default", icon: Building2 },
    { label: "Initiated By", value: scan.initiatedBy || "System", icon: User },
    { label: "Scan Mode", value: scan.type, icon: scan.type === "DEEP" ? Layers : Zap },
    { label: "Is Scheduled", value: scan.isScheduled ? "Yes" : "No", icon: Calendar },
    { label: "Created At", value: formatDateTime(scan.createdAt || ""), icon: Clock },
    { label: "Started At", value: scan.startedAt ? formatDateTime(scan.startedAt) : "N/A", icon: Activity },
    { label: "Completed At", value: scan.completedAt ? formatDateTime(scan.completedAt) : "N/A", icon: Calendar },
  ];

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        {details.map((item) => (
          <div key={item.label} className="flex items-center gap-3 p-3 sm:p-4 rounded-xl bg-muted/5 border border-border/50 hover:bg-muted/10 transition-colors group">
            <div className="flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-lg bg-muted/20 border border-border/10 text-muted-foreground group-hover:text-primary transition-colors">
              <item.icon className="size-4 sm:size-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 leading-none mb-1.5">
                {item.label}
              </p>
              <p className="text-xs font-semibold text-foreground truncate">
                {item.value}
              </p>
            </div>
          </div>
        ))}
        
        {scan.startedAt && scan.completedAt && (
          <div className="flex items-center gap-4 p-4 rounded-xl bg-primary/5 border border-primary/10 hover:bg-primary/10 transition-colors group lg:col-span-2">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 border border-primary/10 text-primary">
              <Timer className="size-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-widest text-primary/60 leading-none mb-1.5">
                Total Execution Time
              </p>
              <p className="text-[13px] font-bold text-primary">
                {formatDuration(scan.startedAt, scan.completedAt)}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

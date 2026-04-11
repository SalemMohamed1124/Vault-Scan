"use client";

import type { ScanFinding, Severity } from "@/types";
import { MobileCard } from "@/components/layout/MobileCard";
import { SeverityBadge } from "@/components/layout/SeverityBadge";
import {
  AlertOctagon,
  AlertTriangle,
  Info,
  Shield,
  Bug,
  MapPin,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import FindingRowActions from "./FindingRowActions";

const severityConfig: Record<Severity, { icon: LucideIcon; theme: "critical" | "high" | "medium" | "success" }> = {
  CRITICAL: { icon: AlertOctagon, theme: "critical" },
  HIGH: { icon: AlertTriangle, theme: "high" },
  MEDIUM: { icon: Info, theme: "medium" },
  LOW: { icon: Shield, theme: "success" },
};

export default function FindingMobileCard({
  finding,
}: {
  finding: ScanFinding;
}) {
  const severity = finding.vulnerability?.severity as Severity;
  const config = severityConfig[severity] || severityConfig.LOW;
  const Icon = config.icon;
  const asset = finding.scan?.asset;

  return (
    <MobileCard className="w-full max-w-full">
      <MobileCard.Header>
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted/30 border border-border/30 text-muted-foreground">
            <Bug className="size-3.5 text-red-500" />
          </div>
          <h4
            className="font-bold text-lg tracking-tight leading-none truncate max-w-[200px]"
            title={finding.vulnerability?.name}
          >
            {finding.vulnerability?.name || "Unknown"}
          </h4>
        </div>
        <SeverityBadge
          theme={config.theme}
          className="shrink-0 gap-1 font-black uppercase text-[9px] px-2 h-5"
        >
          <Icon className="size-2.5" />
          {severity}
        </SeverityBadge>
      </MobileCard.Header>

      <MobileCard.Content>
        <MobileCard.Row>
          <span className="text-xs text-muted-foreground font-medium shrink-0">
            Category:
          </span>
          <span className="truncate max-w-[200px] px-2 py-0.5 bg-muted/40 border border-border/50 text-[10px] font-mono text-muted-foreground rounded-sm">
            {finding.vulnerability?.category || "UNCATEGORIZED"}
          </span>
        </MobileCard.Row>

        <MobileCard.Row>
          <span className="text-xs text-muted-foreground font-medium shrink-0">
            Target:
          </span>
          <span className="text-xs font-bold truncate">
            {asset?.name || "N/A"}
          </span>
        </MobileCard.Row>

        <MobileCard.Row>
          <span className="text-xs text-muted-foreground font-medium shrink-0">
            Location:
          </span>
          <span className="text-[11px] font-mono text-muted-foreground truncate max-w-[150px]">
            {finding.location}
          </span>
        </MobileCard.Row>
      </MobileCard.Content>

      <MobileCard.Footer>
        <FindingRowActions finding={finding} />
      </MobileCard.Footer>
    </MobileCard>
  );
}



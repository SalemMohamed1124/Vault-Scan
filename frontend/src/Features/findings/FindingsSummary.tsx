"use client";

import { ShieldAlert, AlertTriangle, Info, Shield } from "lucide-react";
import { Summary } from "@/components/layout/Summary";

import { useFindingsStats } from "./useFindings";
import { Skeleton } from "@/components/ui/skeleton";

export default function FindingsSummary() {
  const { severityCounts: stats, isPending } = useFindingsStats();

  if (isPending) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
    );
  }

  const counts = stats || {
    CRITICAL: 0,
    HIGH: 0,
    MEDIUM: 0,
    LOW: 0,
  };

  return (
    <Summary data={[]}>
      <Summary.Card
        label="Critical"
        variant="critical"
        icon={<ShieldAlert className="size-4" />}
        counts={counts.CRITICAL}
        sublabel="Impact"
        className="rounded-none"
      />
      <Summary.Card
        label="High"
        variant="high"
        icon={<AlertTriangle className="size-4" />}
        counts={counts.HIGH}
        sublabel="Impact"
        className="rounded-none"
      />
      <Summary.Card
        label="Medium"
        variant="medium"
        icon={<Info className="size-4" />}
        counts={counts.MEDIUM}
        sublabel="Impact"
        className="rounded-none"
      />
      <Summary.Card
        label="Low"
        variant="low"
        icon={<Shield className="size-4" />}
        counts={counts.LOW}
        sublabel="Impact"
        className="rounded-none"
      />
    </Summary>
  );
}


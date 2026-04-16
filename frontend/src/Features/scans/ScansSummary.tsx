"use client";

import { Summary } from "@/components/layout/Summary";
import { Radar, Activity, CheckCircle2, Timer } from "lucide-react";

import { useScansStats } from "./useScans";
import { Skeleton } from "@/components/ui/skeleton";

export default function ScansSummary() {
  const { stats, isPending } = useScansStats();

  if (isPending) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
    );
  }

  return (
    <Summary data={[]}>
      <Summary.Card
        label="Total Scans"
        variant="none"
        icon={<Radar className="size-4" />}
        counts={stats?.total ?? 0}
        sublabel="HISTORY_COUNT"
      />
      <Summary.Card
        label="Running Now"
        variant="informative"
        icon={<Activity className="size-4" />}
        counts={stats?.runningNow ?? 0}
        sublabel="ACTIVE_PROCESSES"
      />
      <Summary.Card
        label="Completed Today"
        variant="none"
        icon={<CheckCircle2 className="size-4" />}
        counts={stats?.completedToday ?? 0}
        sublabel="DAILY_THROUGHPUT"
      />
      <Summary.Card
        label="Avg. Duration"
        variant="none"
        icon={<Timer className="size-4" />}
        counts={stats?.avgDuration ?? "--"}
        sublabel="PROCESSING_TIME"
      />
    </Summary>
  );
}


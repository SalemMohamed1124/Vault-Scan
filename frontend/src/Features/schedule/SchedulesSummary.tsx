"use client";

import { useMemo } from "react";
import { useSchedules } from "./useSchedules";
import { Calendar, Activity, Timer, Pause } from "lucide-react";
import { Summary } from "@/components/layout/Summary";
import { formatDateTime } from "@/lib/utils";

export default function SchedulesSummary() {
  const { items } = useSchedules();

  const stats = useMemo(() => {
    const active = items.filter((s) => s.isActive).length;
    const paused = items.filter((s) => !s.isActive).length;
    const activeSchedules = items.filter((s) => s.isActive && s.nextRunAt);
    const sorted = [...activeSchedules].sort(
      (a, b) =>
        new Date(a.nextRunAt).getTime() - new Date(b.nextRunAt).getTime(),
    );
    const nextRun = sorted[0]?.nextRunAt;

    return { total: items.length, active, paused, nextRun };
  }, [items]);

  return (
    <Summary data={items as unknown as Record<string, unknown>[]}>
      <Summary.Card
        label="Total Schedules"
        sublabel="Automated Tasks"
        icon={<Calendar className="size-4" />}
        counts={stats.total}
        variant="informative"
      />
      <Summary.Card
        label="Status"
        sublabel="Active"
        icon={<Activity className="size-4" />}
        find={{ column: "status", value: "active" }}
        counts={stats.active}
        variant="none"
      />
      <Summary.Card
        label="Status"
        sublabel="Paused"
        icon={<Pause className="size-4" />}
        find={{ column: "status", value: "paused" }}
        counts={stats.paused}
        variant="medium"
      />
      <Summary.Card
        label="Upcoming Scan"
        sublabel="Next scheduled window"
        icon={<Timer className="size-4" />}
        counts={
          stats.nextRun ? formatDateTime(stats.nextRun).split(",")[0] : "None"
        }
        variant="informative"
      />
    </Summary>
  );
}


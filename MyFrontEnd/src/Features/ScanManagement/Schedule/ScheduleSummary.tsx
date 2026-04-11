import { Summary } from "@/components/Customized/summary";
import useSchedules from "./useSchedules";
import { Calendar, Play, Pause, Activity, Zap, Timer } from "lucide-react";
import { format, isAfter, parseISO } from "date-fns";

export default function ScheduleSummary() {
  const { schedules } = useSchedules();

  if (!schedules) return null;

  const nextScan = schedules
    .map((s) => s.nexRunTime)
    .filter((date): date is string => !!date && isAfter(parseISO(date), new Date()))
    .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())[0];

  const nextScanDisplay = nextScan ? format(parseISO(nextScan), "MMM d, HH:mm") : "None";

  return (
    <Summary data={schedules}>
      <Summary.Card
        label="Total Schedules"
        sublabel="All configured schedules"
        icon={<Calendar className="size-4" />}
        counts={schedules.length}
        variant="informative"
      />
      <Summary.Card
        label="Status"
        sublabel="Active"
        icon={<Activity className="size-4" />}
        find={{ column: "status", value: "active" }}
        variant="none"
      />
      <Summary.Card
        label="Status"
        sublabel="Paused"
        icon={<Pause className="size-4" />}
        find={{ column: "status", value: "paused" }}
        variant="medium"
      />
      <Summary.Card
        label="Status"
        sublabel="Running"
        icon={<Play className="size-4" />}
        find={{ column: "status", value: "running" }}
        variant="low"
      />
      <Summary.Card
        label="Status"
        sublabel="Manual"
        icon={<Zap className="size-4" />}
        find={{ column: "status", value: "manual" }}
        variant="none"
      />
      <Summary.Card
        label="Next Scan"
        sublabel="Upcoming scan"
        icon={<Timer className="size-4" />}
        counts={nextScanDisplay}
        variant="informative"
      />
    </Summary>
  );
}

import { SeverityBadge } from "@/components/layout/SeverityBadge";
import { Calendar } from "lucide-react";
import type { ScanSchedule } from "@/types";
import ScheduleRowActions from "./ScheduleRowActions";
import { MobileCard } from "@/components/layout/MobileCard";
import { formatDateTime } from "@/lib/utils";

type ScheduleCardProps = {
  schedule: ScanSchedule;
};

export default function ScheduleMobileCard({ schedule }: ScheduleCardProps) {
  const statusTheme = schedule.isActive ? "none" : "medium";
  const statusLabel = schedule.isActive ? "Active" : "Paused";

  return (
    <MobileCard>
      <MobileCard.Header>
        <div className="flex flex-col">
          <p className="font-semibold text-sm truncate max-w-50">
            {schedule.asset?.name || "Unnamed Asset"}
          </p>
          <p className="text-xs text-muted-foreground truncate max-w-50">
            {schedule.asset?.value}
          </p>
        </div>
        <SeverityBadge theme={statusTheme}>{statusLabel}</SeverityBadge>
      </MobileCard.Header>

      <MobileCard.Content>
        <MobileCard.Row>
          <span className="text-muted-foreground">Scan Type:</span>
          <SeverityBadge theme="outlineSecondary" className="uppercase">
            {schedule.scanType}
          </SeverityBadge>
        </MobileCard.Row>

        <MobileCard.Row>
          <span className="text-muted-foreground">Frequency:</span>
          <span className="text-sm font-medium capitalize">
            {schedule.frequency?.toLowerCase() || "Not scheduled"}
          </span>
        </MobileCard.Row>

        <MobileCard.Row>
          <span className="text-muted-foreground">Next Scan:</span>
          <div className="flex items-center gap-1">
            <Calendar className="size-3 text-muted-foreground" />
            <span className="text-sm">
              {schedule.nextRunAt
                ? formatDateTime(schedule.nextRunAt)
                : "Not scheduled"}
            </span>
          </div>
        </MobileCard.Row>
      </MobileCard.Content>

      <MobileCard.Footer>
        <ScheduleRowActions schedule={schedule} />
      </MobileCard.Footer>
    </MobileCard>
  );
}



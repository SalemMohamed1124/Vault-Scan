import { Badge } from "@/components/Customized/badge";
import { Calendar } from "lucide-react";
import type { Schedule } from "@/Types/data-types";
import ScheduleRowActions from "./ScheduleRowActions";
import { MobileCard } from "@/components/Customized/mobile-card";
import { format, parseISO } from "date-fns";
import { Spinner } from "@/components/ui/spinner";

type ScheduleCardProps = {
  schedule: Schedule;
};

export default function ScheduleMobileCard({ schedule }: ScheduleCardProps) {
  const statusTheme =
    schedule.status === "active"
      ? "none"
      : schedule.status === "paused"
        ? "medium"
        : schedule.status === "running"
          ? "low"
          : "outlineSecondary";

  let frequencyText = "";
  if (schedule?.frequency?.mode === "once") {
    frequencyText = "Once";
  } else if (schedule.frequency) {
    frequencyText = `Every ${schedule.frequency.repeatEvery} ${schedule.frequency.repeatUnit}`;
  } else {
    frequencyText = "Not scheduled";
  }

  return (
    <MobileCard>
      <MobileCard.Header>
        <div className="flex items-center gap-2">
          <p className="font-semibold text-sm truncate max-w-50">{schedule.asset.value}</p>
        </div>
        {schedule.status === "running" ? (
          <div className="flex gap-2 items-center">
            <Spinner className="size-3" />
            <span className="text-xs">Running</span>
          </div>
        ) : (
          <Badge theme={statusTheme}>{schedule.status}</Badge>
        )}
      </MobileCard.Header>

      <MobileCard.Content>
        <MobileCard.Row>
          <span className="text-muted-foreground">Scan Type:</span>
          <Badge theme="outlineSecondary" className="uppercase">
            {schedule.scanType}
          </Badge>
        </MobileCard.Row>

        <MobileCard.Row>
          <span className="text-muted-foreground">Frequency:</span>
          <span className="text-sm font-medium capitalize">{frequencyText}</span>
        </MobileCard.Row>

        <MobileCard.Row>
          <span className="text-muted-foreground">Next Scan:</span>
          <div className="flex items-center gap-1">
            <Calendar className="size-3 text-muted-foreground" />
            <span className="text-sm">
              {schedule.nexRunTime ? format(parseISO(schedule.nexRunTime), "PPP") : "Not scheduled"}
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

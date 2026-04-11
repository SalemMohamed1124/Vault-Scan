import { Badge } from "@/components/Customized/badge";
import type { Schedule } from "@/Types/data-types";
import { DetailCard } from "@/components/Customized/detail-card";
import { parseISO, format } from "date-fns";

export default function ScheduleDetailView({ schedule }: { schedule: Schedule }) {
  const statusTheme =
    schedule.status === "active"
      ? "none"
      : schedule.status === "paused"
        ? "medium"
        : schedule.status === "running"
          ? "low"
          : "outlineSecondary";

  const lastStatusTheme =
    schedule.lastScan?.status === "completed" ? "none" : schedule.lastScan?.status === "failed" ? "critical" : "outlineSecondary";

  let frequencyText = "";
  if (schedule?.frequency?.mode === "once") {
    frequencyText = "Once";
  } else if (schedule.frequency) {
    frequencyText = `Every ${schedule.frequency.repeatEvery} ${schedule.frequency.repeatUnit}`;
  } else {
    frequencyText = "Not scheduled";
  }

  return (
    <DetailCard>
      <DetailCard.Header>
        <h3 className="font-semibold text-xl tracking-tight">{schedule.asset.name}</h3>
        <p className="text-muted-foreground text-sm font-mono">{schedule.asset.value}</p>
      </DetailCard.Header>

      <DetailCard.Section>
        <DetailCard.Row>
          <span className="text-muted-foreground text-sm">Status:</span>
          <Badge theme={statusTheme} className="capitalize">
            {schedule.status}
          </Badge>
        </DetailCard.Row>

        <DetailCard.Row>
          <span className="text-muted-foreground text-sm">Scan Type:</span>
          <Badge theme="outlineSecondary" className="uppercase">
            {schedule.scanType}
          </Badge>
        </DetailCard.Row>

        <DetailCard.Row>
          <span className="text-muted-foreground text-sm">Frequency:</span>
          <Badge theme="outlineSecondary" className="capitalize">
            {frequencyText}
          </Badge>
        </DetailCard.Row>
      </DetailCard.Section>

      {schedule.lastScan ? (
        <DetailCard.Section className="pt-4 border-t">
          <h4 className="font-semibold text-sm mb-4">Last Execution Details</h4>
          <DetailCard.Row>
            <span className="text-muted-foreground text-sm">Status:</span>
            <Badge theme={lastStatusTheme} className="capitalize">
              {schedule.lastScan.status}
            </Badge>
          </DetailCard.Row>
          <DetailCard.Row>
            <span className="text-muted-foreground text-sm">Start Time:</span>
            <span className="text-sm">{format(parseISO(schedule.lastScan.startTime), "PPP p")}</span>
          </DetailCard.Row>
          <DetailCard.Row>
            <span className="text-muted-foreground text-sm">End Time:</span>
            <span className="text-sm">
              {schedule.lastScan.endTime ? format(parseISO(schedule.lastScan.endTime), "PPP p") : "-"}
            </span>
          </DetailCard.Row>
          {schedule.lastScan.duration && (
            <DetailCard.Row>
              <span className="text-muted-foreground text-sm">Duration:</span>
              <span className="text-sm font-mono">{schedule.lastScan.duration}</span>
            </DetailCard.Row>
          )}
        </DetailCard.Section>
      ) : null}

      <DetailCard.Footer>Asset Added: {format(parseISO(schedule.asset.addedDate), "PPP")}</DetailCard.Footer>
    </DetailCard>
  );
}

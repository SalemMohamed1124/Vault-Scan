import { SeverityBadge } from "@/components/layout/SeverityBadge";
import type { Scan } from "@/types";
import { DetailCard } from "@/components/layout/DetailCard";
import { Calendar, Timer, Shield, Target } from "lucide-react";
import { format, parseISO } from "date-fns";
import { formatDuration } from "@/lib/utils";

export default function ScanDetailView({ scan }: { scan: Scan }) {
  const summary = scan.findingsSummary;

  return (
    <DetailCard>
      <DetailCard.Header>
        <h3 className="font-semibold text-xl tracking-tight leading-tight">
          {scan.asset?.name || "Target Asset"}
        </h3>
        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mt-1 font-mono">
          {scan.asset?.value || scan.assetId}
        </p>
      </DetailCard.Header>

      <DetailCard.Section>
        <DetailCard.Row>
          <span className="text-muted-foreground text-sm flex items-center gap-2">
            <Target className="size-3.5" /> Scan Type:
          </span>
          <SeverityBadge variant="outline" className="uppercase text-[10px] font-bold">
            {scan.type} SCAN
          </SeverityBadge>
        </DetailCard.Row>

        <DetailCard.Row>
          <span className="text-muted-foreground text-sm flex items-center gap-2">
            <Calendar className="size-3.5" /> Started:
          </span>
          <span className="text-sm font-medium">
            {scan.startedAt ? format(parseISO(scan.startedAt), "PPP p") : "—"}
          </span>
        </DetailCard.Row>

        <DetailCard.Row>
          <span className="text-muted-foreground text-sm flex items-center gap-2">
            <Timer className="size-3.5" /> Duration:
          </span>
          <span className="text-sm font-medium">
            {scan.startedAt && scan.completedAt
              ? formatDuration(scan.startedAt, scan.completedAt)
              : "In Progress"}
          </span>
        </DetailCard.Row>

        <DetailCard.Row>
          <span className="text-muted-foreground text-sm flex items-center gap-2">
            <Shield className="size-3.5" /> Total Findings:
          </span>
          <span className="text-sm font-bold">{summary?.total || 0}</span>
        </DetailCard.Row>
      </DetailCard.Section>

      {summary && summary.total > 0 && (
        <DetailCard.Section className="mt-2">
          <h4 className="text-[10px] font-black uppercase text-muted-foreground tracking-widest border-b border-border/40 pb-1.5 mb-3">
            Severity Breakdown
          </h4>
          <div className="grid grid-cols-2 gap-3">
            {[
              {
                label: "Critical",
                count: summary.critical,
              },
              {
                label: "High",
                count: summary.high,
              },
              {
                label: "Medium",
                count: summary.medium,
              },
              {
                label: "Low",
                count: summary.low,
              },
            ].map((s, idx) => (
              <SeverityBadge
                key={idx}
                theme={s.label.toUpperCase() as any}
                className="flex items-center justify-between p-2 font-bold w-full"
              >
                <span className="text-[10px] uppercase tracking-wider">
                  {s.label}
                </span>
                <span className="text-xs">{s.count}</span>
              </SeverityBadge>
            ))}
          </div>
        </DetailCard.Section>
      )}

      <DetailCard.Footer>Scan ID: {scan.id}</DetailCard.Footer>
    </DetailCard>
  );
}



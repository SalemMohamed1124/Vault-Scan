import { SeverityBadge } from "@/components/layout/SeverityBadge";
import type { ScanFinding } from "@/types";
import { DetailCard } from "@/components/layout/DetailCard";
import { Calendar, ShieldAlert, Bug, MapPin, Layers } from "lucide-react";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";

export default function FindingDetailView({
  finding,
}: {
  finding: ScanFinding;
}) {
  const severity = finding.vulnerability?.severity || "LOW";

  return (
    <DetailCard>
      <DetailCard.Header>
        <div className="flex items-center gap-2 mb-2">
          <SeverityBadge
            theme={severity.toLowerCase() as any}
            className="gap-2 font-black uppercase text-[10px] tracking-tight"
          >
            <ShieldAlert className="size-3" />
            {severity} RISK
          </SeverityBadge>
        </div>
        <h3 className="font-semibold text-xl tracking-tight leading-tight">
          {finding.vulnerability?.name}
        </h3>
        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mt-1">
          {finding.vulnerability?.category}
        </p>
      </DetailCard.Header>

      <DetailCard.Section>
        <DetailCard.Row>
          <span className="text-muted-foreground text-sm flex items-center gap-2">
            <Layers className="size-3.5" /> Target Asset:
          </span>
          <span className="text-sm font-bold truncate max-w-[200px]">
            {finding.scan?.asset?.name || "N/A"}
          </span>
        </DetailCard.Row>

        <DetailCard.Row className="items-start">
          <span className="text-muted-foreground text-sm flex items-center gap-2 mt-0.5">
            <MapPin className="size-3.5" /> Location:
          </span>
          <span className="text-xs font-mono break-all text-right max-w-[240px]">
            {finding.location}
          </span>
        </DetailCard.Row>

        <DetailCard.Row>
          <span className="text-muted-foreground text-sm flex items-center gap-2">
            <Bug className="size-3.5" /> Severity:
          </span>
          <SeverityBadge
            theme={severity.toLowerCase() as any}
            className="capitalize text-xs"
          >
            {severity}
          </SeverityBadge>
        </DetailCard.Row>

        <DetailCard.Row>
          <span className="text-muted-foreground text-sm flex items-center gap-2">
            <Calendar className="size-3.5" /> Identified:
          </span>
          <span className="text-sm font-medium">
            {finding.scan?.completedAt
              ? format(parseISO(finding.scan.completedAt), "PPP")
              : "—"}
          </span>
        </DetailCard.Row>
      </DetailCard.Section>

      <DetailCard.Section className="mt-2">
        <h4 className="text-[10px] font-black uppercase text-muted-foreground tracking-widest border-b border-border/40 pb-1.5 mb-2">
          Description
        </h4>
        <p className="text-sm leading-relaxed text-foreground/80 italic">
          {finding.vulnerability?.description}
        </p>
      </DetailCard.Section>

      {finding.evidence && (
        <DetailCard.Section className="mt-2">
          <h4 className="text-[10px] font-black uppercase text-muted-foreground tracking-widest border-b border-border/40 pb-1.5 mb-2">
            Evidence
          </h4>
          <div className="rounded-xl bg-muted/30 border border-border/40 p-4 font-mono text-[11px] text-muted-foreground overflow-x-auto whitespace-pre-wrap">
            {finding.evidence}
          </div>
        </DetailCard.Section>
      )}

      <DetailCard.Footer>Finding ID: {finding.id}</DetailCard.Footer>
    </DetailCard>
  );
}



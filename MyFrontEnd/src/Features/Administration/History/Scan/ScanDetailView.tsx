import { Badge } from "@/components/Customized/badge";
import type { Scan } from "@/Types/data-types";
import { DetailCard } from "@/components/Customized/detail-card";
import { format, parseISO } from "date-fns";
import { Clock, Zap } from "lucide-react";

export default function ScanDetailView({ scan }: { scan: Scan }) {
  const status = scan.status;
  const statusTheme =
    status == "completed" ? "none" : status == "failed" ? "critical" : status == "running" ? "low" : "outlineSecondary";

  return (
    <DetailCard>
      <DetailCard.Header>
        <h3 className="font-semibold text-xl tracking-tight">{scan.asset.value}</h3>
        <p className="text-muted-foreground text-sm">{scan.scanType}</p>
      </DetailCard.Header>

      <DetailCard.Section>
        <DetailCard.Row>
          <span className="text-muted-foreground text-sm">Status:</span>
          <Badge theme={statusTheme}>{status}</Badge>
        </DetailCard.Row>

        <DetailCard.Row>
          <span className="text-muted-foreground text-sm">Scan Type:</span>
          <Badge theme="outlineSecondary">{scan.scanType}</Badge>
        </DetailCard.Row>

        <DetailCard.Row>
          <span className="text-muted-foreground text-sm">Asset Type:</span>
          <Badge theme="outlineSecondary" className="capitalize">
            {scan.asset.type}
          </Badge>
        </DetailCard.Row>

        <DetailCard.Row>
          <span className="text-muted-foreground text-sm">Start Time:</span>
          <Badge variant="outline" className="flex gap-2 p-0 w-fit items-center border-none bg-transparent">
            <Clock className="size-4" />
            <span className="text-sm">{scan.startTime ? format(parseISO(scan.startTime), "PPP p") : "-"}</span>
          </Badge>
        </DetailCard.Row>

        <DetailCard.Row>
          <span className="text-muted-foreground text-sm">Duration:</span>
          <Badge variant="outline" className="flex gap-2 p-0 w-fit items-center border-none bg-transparent">
            <Zap className="size-4" />
            <span className="text-sm">{scan.duration}</span>
          </Badge>
        </DetailCard.Row>

        <DetailCard.Row>
          <span className="text-muted-foreground text-sm">Vulnerabilities:</span>
          <Badge theme={scan.severity}>{scan.vulnerabilitiesFound}</Badge>
        </DetailCard.Row>

        <DetailCard.Row>
          <span className="text-muted-foreground text-sm">Severity:</span>
          <Badge theme={scan.severity}>{scan.severity}</Badge>
        </DetailCard.Row>

        <DetailCard.Row>
          <span className="text-muted-foreground text-sm">Trigger Type:</span>
          <Badge theme="outlineSecondary" className="capitalize">
            {scan.triggerType}
          </Badge>
        </DetailCard.Row>
      </DetailCard.Section>

      <DetailCard.Footer>Scan completed {scan.endTime ? format(parseISO(scan.endTime), "PPP") : "N/A"}</DetailCard.Footer>
    </DetailCard>
  );
}

import { Badge } from "@/components/Customized/badge";
import type { Ip } from "@/Types/data-types";
import { DetailCard } from "@/components/Customized/detail-card";
import { format, parseISO } from "date-fns";
import { Calendar } from "lucide-react";

export default function IpDetailView({ ip }: { ip: Ip }) {
  return (
    <DetailCard>
      <DetailCard.Header>
        <h3 className="font-semibold text-xl tracking-tight">{ip.value}</h3>
        <p className="text-muted-foreground text-sm font-mono">{ip.hostname}</p>
      </DetailCard.Header>

      <DetailCard.Section>
        <DetailCard.Row>
          <span className="text-muted-foreground text-sm">Location:</span>
          <Badge theme="outlineSecondary">{ip.location}</Badge>
        </DetailCard.Row>

        <DetailCard.Row>
          <span className="text-muted-foreground text-sm">Open Ports:</span>
          <Badge theme="outlineSecondary">{ip.openPorts}</Badge>
        </DetailCard.Row>

        <DetailCard.Row>
          <span className="text-muted-foreground text-sm">Services:</span>
          <Badge theme="outlineSecondary">{ip.services}</Badge>
        </DetailCard.Row>

        <DetailCard.Row>
          <span className="text-muted-foreground text-sm">Vulnerabilities:</span>
          <Badge theme={ip.severity}>{ip.vulnerabilities}</Badge>
        </DetailCard.Row>

        <DetailCard.Row>
          <span className="text-muted-foreground text-sm">Severity:</span>
          <Badge theme={ip.severity}>{ip.severity}</Badge>
        </DetailCard.Row>
        <DetailCard.Row>
          <span className="text-muted-foreground text-sm">Last Scan:</span>
          <Badge variant="outline" className="flex gap-2 p-0 w-fit items-center border-none bg-transparent">
            <Calendar className="size-4" />
            <span className="text-sm">{ip.lastScan ? format(parseISO(ip.lastScan), "PPP") : "Never"}</span>
          </Badge>
        </DetailCard.Row>
      </DetailCard.Section>

      <DetailCard.Footer>Last scanned {ip.lastScan ? format(parseISO(ip.lastScan), "PPP") : "Never"}</DetailCard.Footer>
    </DetailCard>
  );
}

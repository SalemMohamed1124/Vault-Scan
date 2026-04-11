import { Badge } from "@/components/Customized/badge";
import { Lock, Unlock, Calendar } from "lucide-react";
import type { Port } from "@/Types/data-types";
import { DetailCard } from "@/components/Customized/detail-card";
import { format, parseISO } from "date-fns";

export default function PortDetailView({ port }: { port: Port }) {
  return (
    <DetailCard>
      <DetailCard.Header>
        <h3 className="font-semibold text-xl tracking-tight">
          Port {port.value} ({port.protocol})
        </h3>
        <p className="text-muted-foreground text-sm font-mono">{port.service}</p>
      </DetailCard.Header>

      <DetailCard.Section>
        <DetailCard.Row>
          <span className="text-muted-foreground text-sm">Status:</span>
          <div className="flex items-center gap-2 font-medium">
            {port.status === "open" && <Unlock className="size-3.5 text-red-500" />}
            {port.status === "filtered" && <Lock className="size-3.5 text-orange-500" />}
            {port.status === "closed" && <Lock className="size-3.5 text-green-500" />}
            <span>{port.status}</span>
          </div>
        </DetailCard.Row>

        <DetailCard.Row>
          <span className="text-muted-foreground text-sm">IP Address:</span>
          <Badge theme="outlineSecondary">{port.ip}</Badge>
        </DetailCard.Row>

        <DetailCard.Row>
          <span className="text-muted-foreground text-sm">Banner:</span>
          <Badge theme="outlineSecondary">{port.banner || "N/A"}</Badge>
        </DetailCard.Row>

        <DetailCard.Row>
          <span className="text-muted-foreground text-sm">Vulnerabilities:</span>
          <Badge theme={port.severity}>{port.vulnerabilities}</Badge>
        </DetailCard.Row>

        <DetailCard.Row>
          <span className="text-muted-foreground text-sm">Severity:</span>
          <Badge theme={port.severity}>{port.severity}</Badge>
        </DetailCard.Row>
        <DetailCard.Row>
          <span className="text-muted-foreground text-sm">Last Scan:</span>
          <Badge variant="outline" className="flex gap-2 p-0 w-fit items-center border-none bg-transparent">
            <Calendar className="size-4" />
            <span className="text-sm">{port.lastScan ? format(parseISO(port.lastScan), "PPP") : "Never"}</span>
          </Badge>
        </DetailCard.Row>
      </DetailCard.Section>

      <DetailCard.Footer>Last scanned {port.lastScan ? format(parseISO(port.lastScan), "PPP") : "Never"}</DetailCard.Footer>
    </DetailCard>
  );
}

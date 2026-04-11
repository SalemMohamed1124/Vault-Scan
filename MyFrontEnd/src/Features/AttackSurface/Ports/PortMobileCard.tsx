import type { Port, Severity } from "@/Types/data-types";
import { Badge } from "@/components/Customized/badge";
import PortRowActions from "./PortRowActions";
import { Lock, Unlock, Calendar } from "lucide-react";
import { MobileCard } from "@/components/Customized/mobile-card";
import { format, parseISO } from "date-fns";

function PortMobileCard({ port }: { port: Port }) {
  const status = port.status;
  let statustheme: Severity;
  if (status === "open") statustheme = "critical";
  else if (status === "filtered") statustheme = "medium";
  else if (status === "closed") statustheme = "none";
  else statustheme = "none";

  return (
    <MobileCard>
      <MobileCard.Header>
        <div className="flex items-center gap-2">
          {status === "open" && <Unlock className="size-3.5 text-red-500" />}
          {status === "filtered" && <Lock className="size-3.5 text-orange-500" />}
          {status === "closed" && <Lock className="size-3.5 text-green-500" />}
          <span className="font-bold text-lg">{port.value}</span>
          <Badge variant="secondary">{port.protocol}</Badge>
        </div>
        <Badge theme={port.severity}>{port.severity}</Badge>
      </MobileCard.Header>

      <MobileCard.Content>
        <MobileCard.Row>
          <span className="text-muted-foreground">Vulnerabilities:</span>
          {port.vulnerabilities ? (
            <Badge theme={port.severity}>{port.vulnerabilities}</Badge>
          ) : (
            <Badge theme="none">No Vulnerabilities</Badge>
          )}
        </MobileCard.Row>

        <MobileCard.Row>
          <span className="text-muted-foreground">Status:</span>
          <Badge theme={statustheme}>{port.status}</Badge>
        </MobileCard.Row>

        <MobileCard.Row>
          <span className="text-muted-foreground">Service:</span>
          <Badge theme="outlineSecondary">{port.service}</Badge>
        </MobileCard.Row>

        <MobileCard.Row>
          <span className="text-muted-foreground">IP Address:</span>
          <Badge theme="outlineSecondary">{port.ip}</Badge>
        </MobileCard.Row>
        <MobileCard.Row>
          <span className="text-muted-foreground">Last Scan:</span>
          <Badge variant="outline" className="flex gap-2 p-0 w-fit items-center border-none bg-transparent">
            <Calendar className="size-4" />
            <span className="text-xs text-muted-foreground">
              {port.lastScan ? format(parseISO(port.lastScan), "PPP") : "Never"}
            </span>
          </Badge>
        </MobileCard.Row>
      </MobileCard.Content>

      <MobileCard.Footer>
        <PortRowActions port={port} />
      </MobileCard.Footer>
    </MobileCard>
  );
}

export default PortMobileCard;

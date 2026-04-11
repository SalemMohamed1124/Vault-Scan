import type { Ip } from "@/Types/data-types";
import { Badge } from "@/components/Customized/badge";
import IpRowActions from "./IpRowActions";
import { MobileCard } from "@/components/Customized/mobile-card";
import { Calendar } from "lucide-react";
import { format, parseISO } from "date-fns";

function IpMobileCard({ ip }: { ip: Ip }) {
  return (
    <MobileCard>
      <MobileCard.Header>
        <div className="flex items-center gap-2">
          <span className="font-medium">{ip.value}</span>
        </div>
        <Badge theme={ip.severity}>{ip.severity}</Badge>
      </MobileCard.Header>

      <MobileCard.Content>
        <MobileCard.Row>
          <span className="text-muted-foreground">Vulnerabilities:</span>
          {ip.vulnerabilities ? (
            <Badge theme={ip.severity}>{ip.vulnerabilities}</Badge>
          ) : (
            <Badge theme="none">No Vulnerabilities</Badge>
          )}
        </MobileCard.Row>

        <MobileCard.Row>
          <span className="text-muted-foreground">Services:</span>
          <Badge theme="outlineSecondary">{ip.services}</Badge>
        </MobileCard.Row>
        <MobileCard.Row>
          <span className="text-muted-foreground">Location:</span>
          <Badge theme="outlineSecondary">{ip.location}</Badge>
        </MobileCard.Row>
        <MobileCard.Row>
          <span className="text-muted-foreground">Last Scan:</span>
          <Badge variant="outline" className="flex gap-2 p-0 w-fit items-center border-none bg-transparent">
            <Calendar className="size-4" />
            <span className="text-xs text-muted-foreground">{ip.lastScan ? format(parseISO(ip.lastScan), "PPP") : "Never"}</span>
          </Badge>
        </MobileCard.Row>
      </MobileCard.Content>

      <MobileCard.Footer>
        <IpRowActions ip={ip} />
      </MobileCard.Footer>
    </MobileCard>
  );
}

export default IpMobileCard;

import type { Scan } from "@/Types/data-types";
import { Badge } from "@/components/Customized/badge";
import ScanRowActions from "./ScanRowActions";
import { MobileCard } from "@/components/Customized/mobile-card";
import { Clock, Zap } from "lucide-react";
import { format, parseISO } from "date-fns";

function ScanMobileCard({ scan }: { scan: Scan }) {
  const status = scan.status;
  const statusTheme =
    status == "completed" ? "none" : status == "failed" ? "critical" : status == "running" ? "low" : "outlineSecondary";

  return (
    <MobileCard>
      <MobileCard.Header>
        <div className="flex items-center gap-2">
          <span className="font-medium">{scan.asset.value}</span>
        </div>
        <Badge theme={statusTheme}>{status}</Badge>
      </MobileCard.Header>

      <MobileCard.Content>
        <MobileCard.Row>
          <span className="text-muted-foreground">Vulnerabilities:</span>
          {scan.vulnerabilitiesFound > 0 ? (
            <Badge theme={scan.severity}>{scan.vulnerabilitiesFound}</Badge>
          ) : (
            <Badge theme="none">No Vulnerabilities</Badge>
          )}
        </MobileCard.Row>

        <MobileCard.Row>
          <span className="text-muted-foreground">Severity:</span>
          <Badge theme={scan.severity}>{scan.severity}</Badge>
        </MobileCard.Row>
        <MobileCard.Row>
          <span className="text-muted-foreground">Duration:</span>
          <Badge theme="outlineSecondary" className="flex gap-1 items-center">
            <Zap className="size-3" />
            {scan.duration}
          </Badge>
        </MobileCard.Row>
        <MobileCard.Row>
          <span className="text-muted-foreground">Started:</span>
          <Badge variant="outline" className="flex gap-2 p-0 w-fit items-center border-none bg-transparent">
            <Clock className="size-4" />
            <span className="text-xs text-muted-foreground">
              {scan.startTime ? format(parseISO(scan.startTime), "PPP p") : "-"}
            </span>
          </Badge>
        </MobileCard.Row>
      </MobileCard.Content>

      <MobileCard.Footer>
        <ScanRowActions scan={scan} />
      </MobileCard.Footer>
    </MobileCard>
  );
}

export default ScanMobileCard;

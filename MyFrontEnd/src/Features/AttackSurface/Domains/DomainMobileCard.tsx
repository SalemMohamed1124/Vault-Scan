import { Badge } from "@/components/Customized/badge";
import { Globe, Calendar } from "lucide-react";
import type { Domain } from "@/Types/data-types";
import DomainRowActions from "./DomainRowActions";
import { MobileCard } from "@/components/Customized/mobile-card";
import { format, parseISO } from "date-fns";

type DomainCardProps = {
  domain: Domain;
};

export default function DomainMobileCard({ domain }: DomainCardProps) {
  const sslTheme = domain.ssl === "valid" ? "none" : domain.ssl === "expired" ? "critical" : "high";
  return (
    <MobileCard>
      <MobileCard.Header>
        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4 text-muted-foreground" />
          <p className="font-semibold text-sm truncate max-w-45">{domain.value}</p>
        </div>
        <Badge theme={domain.severity}>{domain.severity}</Badge>
      </MobileCard.Header>

      <MobileCard.Content>
        <MobileCard.Row>
          <span className="text-muted-foreground">Vulnerabilities:</span>
          {domain.vulnerabilities ? (
            <Badge theme={domain.severity}>{domain.vulnerabilities}</Badge>
          ) : (
            <Badge theme="none">No Vulnerabilities</Badge>
          )}
        </MobileCard.Row>
        <MobileCard.Row>
          <span className="text-muted-foreground">SSL Status</span>
          <div className="flex items-center gap-1">
            <Badge theme={sslTheme}>{domain.ssl}</Badge>
          </div>
        </MobileCard.Row>
        <MobileCard.Row>
          <span className="text-muted-foreground">IP Address:</span>
          <Badge theme="outlineSecondary">{domain.ip}</Badge>
        </MobileCard.Row>
        <MobileCard.Row>
          <span className="text-muted-foreground">Created Date:</span>
          <Badge variant="outline" className="flex gap-2 p-0 w-fit items-center border-none bg-transparent">
            <Calendar className="size-4" />
            <span className="text-xs text-muted-foreground">
              {domain.createdDate ? format(parseISO(domain.createdDate), "PPP") : "N/A"}
            </span>
          </Badge>
        </MobileCard.Row>
      </MobileCard.Content>

      <MobileCard.Footer>
        <DomainRowActions domain={domain} />
      </MobileCard.Footer>
    </MobileCard>
  );
}

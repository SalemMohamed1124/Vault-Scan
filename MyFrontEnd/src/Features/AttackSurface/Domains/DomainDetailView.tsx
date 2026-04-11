import { Badge } from "@/components/Customized/badge";
import type { Domain } from "@/Types/data-types";
import { DetailCard } from "@/components/Customized/detail-card";
import { format, parseISO } from "date-fns";
import { Calendar } from "lucide-react";

export default function DomainDetailView({ domain }: { domain: Domain }) {
  const sslTheme = domain.ssl === "valid" ? "none" : domain.ssl === "expired" ? "critical" : "high";
  const statusTheme = domain.status === "active" ? "none" : "critical";

  return (
    <DetailCard>
      <DetailCard.Header>
        <h3 className="font-semibold text-xl tracking-tight">{domain.value}</h3>
        <p className="text-muted-foreground text-sm font-mono">{domain.ip}</p>
      </DetailCard.Header>

      <DetailCard.Section>
        <DetailCard.Row>
          <span className="text-muted-foreground text-sm">Domain Status:</span>
          <Badge theme={statusTheme}>{domain.status}</Badge>
        </DetailCard.Row>

        <DetailCard.Row>
          <span className="text-muted-foreground text-sm">SSL Status:</span>
          <Badge theme={sslTheme}>{domain.ssl}</Badge>
        </DetailCard.Row>

        <DetailCard.Row>
          <span className="text-muted-foreground text-sm">Vulnerabilities:</span>
          <Badge theme={domain.severity}>{domain.vulnerabilities}</Badge>
        </DetailCard.Row>

        <DetailCard.Row>
          <span className="text-muted-foreground text-sm">Severity:</span>

          <Badge theme={domain.severity}>{domain.severity}</Badge>
        </DetailCard.Row>
      </DetailCard.Section>

      <DetailCard.Section className="pt-4 border-t">
        <DetailCard.Row>
          <span className="text-muted-foreground text-sm">Registrar:</span>
          <Badge theme="outlineSecondary">{domain.registrar || "N/A"}</Badge>
        </DetailCard.Row>

        {domain.nameServers && domain.nameServers.length > 0 ? (
          <DetailCard.Row className="items-baseline">
            <span className="text-muted-foreground text-sm">nameServers:</span>
            <div className="flex flex-col gap-1">
              {domain.nameServers.map((ns) => (
                <Badge theme="outlineSecondary" key={ns}>
                  {ns}
                </Badge>
              ))}
            </div>
          </DetailCard.Row>
        ) : null}

        <DetailCard.Row>
          <span className="text-muted-foreground text-sm">Created Date:</span>
          <Badge variant="outline" className="flex gap-2 p-0 w-fit items-center border-none bg-transparent">
            <Calendar className="size-4" />
            <span className="text-sm">{domain.createdDate ? format(parseISO(domain.createdDate), "PPP") : "N/A"}</span>
          </Badge>
        </DetailCard.Row>
        <DetailCard.Row>
          <span className="text-muted-foreground text-sm">Expiry Date:</span>
          <Badge variant="outline" className="flex gap-2 p-0 w-fit items-center border-none bg-transparent">
            <Calendar className="size-4" />
            <span className="text-sm">{domain.expiryDate ? format(parseISO(domain.expiryDate), "PPP") : "N/A"}</span>
          </Badge>
        </DetailCard.Row>
      </DetailCard.Section>

      <DetailCard.Footer>Last scanned {domain.lastScan ? format(parseISO(domain.lastScan), "PPP") : "Never"}</DetailCard.Footer>
    </DetailCard>
  );
}

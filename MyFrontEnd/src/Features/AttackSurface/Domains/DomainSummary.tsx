import { Summary } from "@/components/Customized/summary";
import useDomains from "@/Features/AttackSurface/Domains/useDomains";
import { ShieldAlert, AlertTriangle, AlertCircle } from "lucide-react";

export default function DomainSummary() {
  const { domains } = useDomains();

  if (!domains) return null;

  return (
    <Summary data={domains}>
      <Summary.Card
        icon={<ShieldAlert className="size-4" />}
        find={{ column: "severity", value: "critical" }}
        variant="critical"
      />
      <Summary.Card icon={<AlertTriangle className="size-4" />} find={{ column: "severity", value: "high" }} variant="high" />
      <Summary.Card icon={<AlertCircle className="size-4" />} find={{ column: "severity", value: "medium" }} variant="medium" />
      <Summary.Card icon={<AlertCircle className="size-4" />} find={{ column: "severity", value: "low" }} variant="low" />
    </Summary>
  );
}

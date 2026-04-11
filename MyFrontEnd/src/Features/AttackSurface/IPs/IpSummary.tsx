import { Summary } from "@/components/Customized/summary";
import useIps from "@/Features/AttackSurface/IPs/useIps";
import { ShieldAlert, AlertTriangle, AlertCircle } from "lucide-react";

export default function IpSummary() {
  const { ips } = useIps();
  if (!ips) return null;
  return (
    <Summary data={ips || []}>
      <Summary.Card find={{ column: "severity", value: "critical" }} variant="critical" icon={<ShieldAlert className="size-4" />} />
      <Summary.Card find={{ column: "severity", value: "high" }} variant="high" icon={<AlertTriangle className="size-4" />} />
      <Summary.Card find={{ column: "severity", value: "medium" }} variant="medium" icon={<AlertCircle className="size-4" />} />
      <Summary.Card find={{ column: "severity", value: "low" }} variant="low" icon={<AlertCircle className="size-4" />} />
    </Summary>
  );
}

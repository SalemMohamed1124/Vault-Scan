import { Summary } from "@/components/Customized/summary";
import useScan from "@/Features/Administration/History/Scan/useScans";
import { ShieldAlert, AlertTriangle, AlertCircle, CheckCircle } from "lucide-react";

export default function ScansSummary() {
  const { scans = [] } = useScan();
  if (!scans) return null;
  return (
    <Summary data={scans}>
      <Summary.Card
        find={{ column: "severity", value: "critical" }}
        variant="critical"
        icon={<ShieldAlert className="size-4" />}
      />
      <Summary.Card find={{ column: "severity", value: "high" }} variant="high" icon={<AlertTriangle className="size-4" />} />
      <Summary.Card find={{ column: "severity", value: "medium" }} variant="medium" icon={<AlertCircle className="size-4" />} />
      <Summary.Card find={{ column: "status", value: "completed" }} variant="low" icon={<CheckCircle className="size-4" />} />
    </Summary>
  );
}

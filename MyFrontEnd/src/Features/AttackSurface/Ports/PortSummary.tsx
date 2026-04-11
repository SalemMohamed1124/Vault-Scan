import { Summary } from "@/components/Customized/summary";
import usePorts from "./usePorts";
import { ShieldAlert, AlertTriangle, AlertCircle } from "lucide-react";

export default function PortSummary() {
  const { ports } = usePorts();

  if (!ports) return null;

  return (
    <>
      <Summary data={ports}>
        <Summary.Card find={{ column: "status", value: "open" }} variant="high" icon={<ShieldAlert className="size-4" />} />
        <Summary.Card find={{ column: "status", value: "filtered" }} variant="medium" icon={<AlertTriangle className="size-4" />} />
        <Summary.Card find={{ column: "status", value: "closed" }} variant="low" icon={<AlertCircle className="size-4" />} />
      </Summary>
    </>
  );
}
  
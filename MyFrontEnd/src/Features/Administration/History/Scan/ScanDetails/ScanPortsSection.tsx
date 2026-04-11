import type { Port } from "@/Types/data-types";
import { DataTable } from "@/components/DataTable/DataTable";
import { PortsColumns } from "@/Features/AttackSurface/Ports/PortsColumns";
import { Summary } from "@/components/Customized/summary";
import { Lock, Unlock, AlertTriangle } from "lucide-react";

interface ScanPortsSectionProps {
  ports: Port[];
}

export default function ScanPortsSection({ ports }: ScanPortsSectionProps) {
  const openPorts = ports.filter((p) => p.status === "open").length;
  const filteredPorts = ports.filter((p) => p.status === "filtered").length;
  const closedPorts = ports.filter((p) => p.status === "closed").length;

  return (
    <section>
      <header>
        <title>Ports Discovered</title>

        <header />
        <div className="flex flex-col gap-6">
          {/* Summary Cards */}
          <Summary data={ports}>
            <Summary.Card
              icon={<Unlock className="size-4" />}
              counts={openPorts}
              sublabel="total open"
              label="Ports"
              variant="critical"
            />
            <Summary.Card
              icon={<AlertTriangle className="size-4" />}
              counts={filteredPorts}
              sublabel="filtered"
              label="Ports"
              variant="high"
            />
            <Summary.Card
              icon={<Lock className="size-4" />}
              counts={closedPorts}
              sublabel="closed"
              label="Ports"
              variant="medium"
            />
          </Summary>

          {/* Ports Table */}
          <div className="w-full">
            <DataTable tableName="ScanPortsTable" data={ports} columns={PortsColumns} isLoading={false} error={null} />
          </div>
        </div>
      </header>
    </section>
  );
}

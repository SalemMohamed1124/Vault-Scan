import type { Vulnerability } from "@/Types/data-types";
import { DataTable } from "@/components/DataTable/DataTable";
import { VulnerabilitiesColumns } from "@/Features/Vulnerabilities/Open/VulnerabilitiesColumns";
import { Summary } from "@/components/Customized/summary";
import { ShieldAlert, AlertTriangle, AlertCircle, ChartColumnBig } from "lucide-react";
import { recordsInThisMonth, recordsInThisWeek } from "@/lib/utils";

interface ScanVulnerabilitiesSectionProps {
  vulnerabilities: Vulnerability[];
}

export default function ScanVulnerabilitiesSection({ vulnerabilities }: ScanVulnerabilitiesSectionProps) {
  const discoverThisWeek = recordsInThisWeek(vulnerabilities.map((v) => v.discovered));
  const discoverThisMonth = recordsInThisMonth(vulnerabilities.map((v) => v.discovered));

  return (
    <section>
      <header>
        <title>Vulnerabilities Found</title>
      </header>
      <main>
        <div className="flex flex-col gap-6">
          <Summary data={vulnerabilities}>
            <Summary.Card
              icon={<ShieldAlert className="size-4" />}
              find={{ column: "severity", value: "critical" }}
              variant="critical"
            />
            <Summary.Card
              icon={<AlertTriangle className="size-4" />}
              find={{ column: "severity", value: "high" }}
              variant="high"
            />
            <Summary.Card
              icon={<AlertCircle className="size-4" />}
              find={{ column: "severity", value: "medium" }}
              variant="medium"
            />
            <Summary.Card
              icon={<ChartColumnBig className="size-4" />}
              counts={discoverThisWeek}
              sublabel="this week"
              label="Discovered"
              variant="informative"
            />
            <Summary.Card
              icon={<ChartColumnBig className="size-4" />}
              counts={discoverThisMonth}
              sublabel="this month"
              label="Discovered"
              variant="informative"
            />
          </Summary>

          <div className="w-full">
            <DataTable
              tableName="ScanVulnerabilitiesTable"
              data={vulnerabilities}
              columns={VulnerabilitiesColumns}
              isLoading={false}
              error={null}
            />
          </div>
        </div>
      </main>
    </section>
  );
}

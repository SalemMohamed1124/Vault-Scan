import VulnerabilitiesFixedTable from "@/Features/Vulnerabilities/Fixed/VulnerabilitiesFixedTable";
import VulnerabilityFixedSummary from "@/Features/Vulnerabilities/Fixed/VulnerabilityFixedSummary";

function Fixed() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Fixed Vulnerabilities</h1>
        <p className="text-muted-foreground">Successfully remediated security vulnerabilities.</p>
      </div>

      <VulnerabilityFixedSummary />

      <div className="w-full">
        <VulnerabilitiesFixedTable />
      </div>
    </div>
  );
}

export default Fixed;

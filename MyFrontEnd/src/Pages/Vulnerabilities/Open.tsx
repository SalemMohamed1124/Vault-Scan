import VulnerabilitiesTable from "@/Features/Vulnerabilities/Open/VulnerabilitiesTable";
import VulnerabilitySummary from "@/Features/Vulnerabilities/Open/VulnerabilitySummary";

function Open() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Open Vulnerabilities</h1>
        <p className="text-muted-foreground">Manage and track all identified security vulnerabilities .</p>
      </div>

      <VulnerabilitySummary />

      <div className="w-full">
        <VulnerabilitiesTable />
      </div>
    </div>
  );
}

export default Open;

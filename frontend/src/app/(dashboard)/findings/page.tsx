import FindingsSummary from "@/Features/findings/FindingsSummary";
import FindingsTable from "@/Features/findings/FindingsTable";

export default function FindingsPage() {
  return (
    <div className="w-full space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Findings</h1>
        <p className="text-sm text-muted-foreground">Monitor and investigate vulnerability findings</p>
      </div>

      <div className="w-full">
        <FindingsSummary />
      </div>

      <div className="w-full">
        <FindingsTable />
      </div>
    </div>
  );
}

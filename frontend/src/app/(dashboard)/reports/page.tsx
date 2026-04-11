import ReportSummary from "@/Features/reports/ReportSummary";
import ReportsTable from "@/Features/reports/ReportsTable";

export default function ReportsPage() {
  return (
    <div className="w-full space-y-2">
      <div>
        <h1 className="text-2xl font-semibold">Reports</h1>
        <h2 className="text-muted-foreground">Generated documentation & audit exports</h2>
      </div>
      
      <div className="w-full">
        <ReportSummary />
      </div>

      <div className="w-full">
        <ReportsTable />
      </div>
    </div>
  );
}

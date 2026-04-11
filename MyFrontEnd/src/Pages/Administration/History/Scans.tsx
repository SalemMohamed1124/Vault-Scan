import ScansTable from "@/Features/Administration/History/Scan/ScansTable";
import ScansSummary from "@/Features/Administration/History/Scan/ScansSummary";

function ScanHistory() {
  return (
    <div className="w-full space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Scans </h1>
        <h2 className="text-muted-foreground ">View and analyze all past scan executions</h2>
      </div>
      <div>
        <ScansSummary />
      </div>
      <div className="w-full">
        <ScansTable />
      </div>
    </div>
  );
}
export default ScanHistory;

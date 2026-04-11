import ScansSummary from "@/Features/scans/ScansSummary";
import ScansTable from "@/Features/scans/ScansTable";

export default function ScansPage() {
  return (
    <div className="w-full space-y-2">
      <div>
        <h1 className="text-2xl font-semibold">Scans</h1>
        <h2 className="text-muted-foreground">Monitor discovery operations and progress</h2>
      </div>

      <div className="w-full">
        <ScansSummary />
      </div>

      <div className="w-full">
        <ScansTable />
      </div>
    </div>
  );
}

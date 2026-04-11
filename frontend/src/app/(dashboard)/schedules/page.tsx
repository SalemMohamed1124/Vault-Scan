import SchedulesSummary from "@/Features/schedule/SchedulesSummary";
import SchedulesTable from "@/Features/schedule/SchedulesTable";

export default function SchedulesPage() {
  return (
    <div className="w-full space-y-2">
      <div>
        <h1 className="text-2xl font-semibold">Scan Automation</h1>
        <h2 className="text-muted-foreground ">Monitor and manage your recurring scans</h2>
      </div>
      <div className="w-full">
        <SchedulesSummary />
      </div>

      <div className="w-full">
        <SchedulesTable />
      </div>
    </div>
  );
}

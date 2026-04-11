import SchedulesTable from "@/Features/ScanManagement/Schedule/ScheduleTable";
import ScheduleSummary from "@/Features/ScanManagement/Schedule/ScheduleSummary";

function Schedule() {
  return (
    <div className="w-full space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Schedules</h1>
        <h2 className="text-muted-foreground ">Monitor and manage your schedules</h2>
      </div>

      <div className="w-full">
        <ScheduleSummary />
      </div>

      <div className="w-full">
        <SchedulesTable />
      </div>
    </div>
  );
}
export default Schedule;

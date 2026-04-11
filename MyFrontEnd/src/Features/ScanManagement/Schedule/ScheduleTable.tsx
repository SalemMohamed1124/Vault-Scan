import { DataTable } from "@/components/DataTable/DataTable";
import { ScheduleColumns } from "./ScheduleColumns";
import useSchedules from "./useSchedules";
import useScheduleFormModals from "./useScheduleFormModals";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

function SchedulesTable() {
  const { isPending, schedules = [], error } = useSchedules();
  const { openAddSchedule } = useScheduleFormModals();

  return (
    <DataTable
      columns={ScheduleColumns}
      data={schedules}
      isLoading={isPending}
      tableName="SchedulesTable"
      error={error}
      extraActions={
        <Button onClick={openAddSchedule} variant="primary">
          <Plus />
          Add Schedule
        </Button>
      }
    />
  );
}
export default SchedulesTable;

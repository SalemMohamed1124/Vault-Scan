"use client";

import { DataTable } from "@/components/dataTable/DataTable";
import { ScheduleColumns } from "./ScheduleColumns";
import { useSchedules } from "./useSchedules";
import { useScheduleFormModals } from "./useScheduleFormModals";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export default function SchedulesTable() {
  const { isPending, schedules = [], error } = useSchedules();
  const { openNew } = useScheduleFormModals();

  return (
    <DataTable
      columns={ScheduleColumns as any}
      data={schedules}
      isPending={isPending}
      tableName="SchedulesTable"
      error={error as Error}
      extraActions={
        <Button onClick={() => openNew()} variant="primary">
          <Plus className="size-4 mr-2" />
          Add Schedule
        </Button>
      }
    />
  );
}

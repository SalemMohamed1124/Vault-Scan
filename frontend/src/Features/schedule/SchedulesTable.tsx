"use client";

import { DataTable } from "@/components/dataTable/DataTable";
import { ScheduleColumns } from "./ScheduleColumns";
import { useSchedules } from "./useSchedules";
import { useScheduleFormModals } from "./useScheduleFormModals";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export default function SchedulesTable() {
  const { isPending, items, error, isError } = useSchedules();
  const { openNew } = useScheduleFormModals();

  return (
    <DataTable
      columns={ScheduleColumns as any}
      data={items}
      isPending={isPending}
      tableName="SchedulesTable"
      error={isError ? (error as Error) : undefined}
      extraActions={
        <Button onClick={() => openNew()} variant="primary">
          <Plus className="size-4 mr-2" />
          Add Schedule
        </Button>
      }
    />
  );
}

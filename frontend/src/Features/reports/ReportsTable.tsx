"use client";

import { useReports } from "./useReports";
import { ReportColumns } from "./ReportColumns";
import { DataTable } from "@/components/dataTable/DataTable";
import { ReportTableActions } from "./useReportFormModals";

export default function ReportsTable() {
  const { reports, isPending } = useReports();

  return (
    <DataTable
      tableName="ReportsTable"
      columns={ReportColumns}
      data={reports?.data || []}
      isPending={isPending}
      toolbar={{ export: false, search: true, filter: true }}
      extraActions={
        <div className="flex items-center gap-2">
          <ReportTableActions />
        </div>
      }
    />
  );
}

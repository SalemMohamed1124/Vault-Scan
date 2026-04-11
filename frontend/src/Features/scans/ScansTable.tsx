"use client";

import { useScans } from "./useScans";
import { ScanColumns } from "./ScanColumns";
import { DataTable } from "@/components/dataTable/DataTable";
import { ScanTableActions } from "./useScanFormModals";
import { useRouter } from "next/navigation";

export default function ScansTable() {
  const router = useRouter();
  const { scans, isPending } = useScans({ limit: 10000 });

  return (
    <DataTable
      tableName="Scans"
      columns={ScanColumns}
      data={scans?.data || []}
      isPending={isPending}
      extraActions={<ScanTableActions />}
      onRowClick={(scan) => router.push(`/scans/${scan.id}`)}
    />
  );
}

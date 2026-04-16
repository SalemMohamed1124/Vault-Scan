"use client";

import { useState } from "react";
import { useFindings } from "./useFindings";
import { FindingColumns } from "./FindingColumns";
import { DataTable } from "@/components/dataTable/DataTable";
import { SeverityBadge } from "@/components/layout/SeverityBadge";

import { FindingTableActions } from "./FindingTableActions";

export default function FindingsTable() {
  const { items, isPending } = useFindings({
    limit: 5000,
  });

  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  return (
    <DataTable
      tableName="FindingsTable"
      columns={FindingColumns}
      data={items}
      isPending={isPending}
      toolbar={{ search: true, filter: true, viewOptions: true, export: true }}
      selectedIds={selectedIds}
      onSelectedIdsChange={setSelectedIds}
      extraActions={
        <FindingTableActions
          selectedIds={selectedIds}
          onComplete={() => setSelectedIds([])}
        />
      }
    />
  );
}



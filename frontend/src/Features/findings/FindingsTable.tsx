"use client";

import { useState } from "react";
import { useFindings, useDeleteFindings } from "./useFindings";
import { FindingColumns } from "./FindingColumns";
import { DataTable } from "@/components/dataTable/DataTable";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { useConfirm } from "@/Contexts/ConfirmModalContext";
import { SeverityBadge } from "@/components/layout/SeverityBadge";
import { cn } from "@/lib/utils";

import { FindingTableActions } from "./FindingTableActions";

export default function FindingsTable() {
  const { data, isPending } = useFindings({
    limit: 5000,
  });

  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  return (
    <DataTable
      tableName="FindingsTable"
      columns={FindingColumns}
      data={data?.data || []}
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



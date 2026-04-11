"use client";

import type { Table } from "@tanstack/react-table";
import { Input } from "@/components/ui/input";
import { useSidebar } from "@/components/ui/sidebar";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

export type searchColumn = {
  column: string;
  placeholder?: string;
};

interface DataTableSearchColumnProps<TData> {
  table: Table<TData>;
  searchColumn?: searchColumn;
}

// Helper function to get nested property value using dot notation
function getNestedValue(obj: Record<string, any>, path: string): any {
  return path.split(".").reduce((current, key) => current?.[key], obj);
}

function DataTableSearchColumn<TData>({ table, searchColumn }: DataTableSearchColumnProps<TData>) {
  const { isMobile } = useSidebar();

  // Set up custom filter function for searching to support partial matches on numeric fields
  useEffect(() => {
    if (!searchColumn) return;

    const isNestedPath = searchColumn.column.includes(".");
    const baseColumn = isNestedPath ? searchColumn.column.split(".")[0] : searchColumn.column;
    const column = table.getColumn(baseColumn);

    if (column) {
      column.columnDef.filterFn = (row, columnId, filterValue) => {
        if (!filterValue) return true;

        let value;
        if (isNestedPath) {
          value = getNestedValue(row.getValue(columnId), searchColumn.column.substring(baseColumn.length + 1));
        } else {
          value = row.getValue(columnId);
        }

        if (value == null) return false;

        return String(value).toLowerCase().includes(String(filterValue).toLowerCase());
      };
    }
  }, [searchColumn, table]);

  if (!searchColumn) return null;

  // Extract the base column name (before the first dot)
  const baseColumn = searchColumn.column.includes(".") ? searchColumn.column.split(".")[0] : searchColumn.column;

  // Get a user-friendly display name for the placeholder
  const displayName = searchColumn.column.includes(".") ? searchColumn.column.split(".").pop() : searchColumn.column;

  return (
    <Input
      placeholder={searchColumn.placeholder || `search by ${displayName}`}
      value={(table.getColumn(baseColumn)?.getFilterValue() as string) ?? ""}
      onChange={(event) => table.getColumn(baseColumn)?.setFilterValue(event.target.value)}
      className={isMobile ? "w-full" : "min-w-70 max-w-125 flex-1"}
    />
  );
}
export default DataTableSearchColumn;

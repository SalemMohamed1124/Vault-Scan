"use client";

import * as React from "react";
import type { Table } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import { CirclePlus, X } from "lucide-react";
import { SeverityBadge } from "@/components/layout/SeverityBadge";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";

interface DataTableColumnFilterProps<TData> {
  table: Table<TData>;
  columnId: string;
}

export function DataTableColumnFilter<TData>({
  table,
  columnId,
}: DataTableColumnFilterProps<TData>) {
  const column = table.getColumn(columnId);
  const rowsLength = table.getCoreRowModel().rows.length;

  // derive unique values from rows
  const uniqueValues = React.useMemo(() => {
    const values = new Set<string>();
    table.getCoreRowModel().rows.forEach((row) => {
      const value = row.getValue(columnId) as string | string[] | undefined;
      if (Array.isArray(value)) {
        value.forEach((v) => values.add(v));
      } else if (value != null) {
        values.add(String(value));
      }
    });
    return Array.from(values);
  }, [table, columnId, rowsLength]);

  if (!column) return null;

  // get selected values
  const selectedValues = (column.getFilterValue() as string[]) ?? [];

  const toggleValue = (value: string) => {
    column.setFilterValue(
      selectedValues.includes(value)
        ? selectedValues.filter((v) => v !== value)
        : [...selectedValues, value],
    );
  };

  const clearFilter = (e: React.MouseEvent) => {
    e.stopPropagation(); // prevent opening the dropdown
    column.setFilterValue([]);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 capitalize font-semibold flex flex-wrap items-center h-9"
        >
          <CirclePlus className="h-4 w-4 opacity-50" />
          {columnId}
          {selectedValues.map((value) => (
            <SeverityBadge key={value} variant="secondary" className="ml-1 text-xs">
              {value}
            </SeverityBadge>
          ))}
        </Button>
      </DropdownMenuTrigger>

      {/* Clear all button */}

      {selectedValues.length > 0 && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 p-0"
              onClick={clearFilter}
            >
              <X className="h-3 w-3" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">Rest filter</TooltipContent>
        </Tooltip>
      )}
      <DropdownMenuContent align="start" className="w-56 max-h-[300px] ">
        <DropdownMenuLabel className="capitalize">
          Filter by {columnId}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {uniqueValues.map((value) => (
          <DropdownMenuCheckboxItem
            key={value}
            className="capitalize"
            checked={selectedValues.includes(value)}
            onCheckedChange={() => toggleValue(value)}
            onSelect={(event) => event.preventDefault()} // keep menu open
          >
            {value}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}



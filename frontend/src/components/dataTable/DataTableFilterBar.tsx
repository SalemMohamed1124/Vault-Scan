"use client";

import type { Table } from "@tanstack/react-table";
import { DataTableColumnFilter } from "./DataTableColumnFilter";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { useRef } from "react";

interface DataTableFilterBarProps<TData> {
  table: Table<TData>;
  columns?: string[];
}

export function DataTableFilterBar<TData>({
  table,
  columns,
}: DataTableFilterBarProps<TData>) {
  const scrollRef = useRef<HTMLDivElement>(null);

  if (!columns || columns.length === 0) return null;

  // 3. Define the scroll handler
  const handleWheel = (e: React.WheelEvent) => {
    if (scrollRef.current) {
      // If the user is scrolling vertically, move the bar horizontally instead
      if (e.deltaY !== 0) {
        scrollRef.current.scrollLeft += e.deltaY;
      }
    }
  };
  return (
    <ScrollArea
      className="flex-1 min-w-0"
      onWheel={handleWheel} // 4. Attach listener
    >
      <div className="flex items-center gap-2" ref={scrollRef}>
        {columns.map((columnId) => {
          const column = table.getColumn(columnId);
          if (!column) return null;

          return (
            <DataTableColumnFilter
              key={columnId}
              table={table}
              columnId={columnId}
            />
          );
        })}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}

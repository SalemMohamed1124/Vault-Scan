"use client";

import {
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnFiltersState,
  type SortingState,
  type TableMeta,
  type VisibilityState,
} from "@tanstack/react-table";
import { useEffect, useMemo, useState } from "react";
import { UseTableRefRegistry } from "@/hooks/UseTableRefRegistry";
import { useSidebar } from "@/components/ui/sidebar";
import type { searchColumn as SearchColumn } from "@/components/dataTable/DataTableSearchColumn";

interface UseDataTableProps<TData, TValue> {
  data: TData[];
  columns: ColumnDef<TData, TValue>[];
  tableName: string;
  meta?: TableMeta<TData>;
  columnVisibility?: VisibilityState;
  cardsLayout?: boolean;
  disablePagination?: boolean;
  selectedIds?: string[];
  onSelectedIdsChange?: (ids: string[]) => void;
}

export function useDataTable<TData, TValue>({
  data,
  columns,
  tableName,
  meta,
  cardsLayout,
  disablePagination,
  selectedIds,
  onSelectedIdsChange,
}: UseDataTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [rowSelection, setRowSelection] = useState({});
  const { isMobile } = useSidebar();
  const useMobileUI = isMobile || cardsLayout;

  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: disablePagination ? 1000 : 10,
  });

  const getVisibility = (isMobileView: boolean) => {
    return columns.reduce((acc, col) => {
      const id = col.id || (col as any).accessorKey;
      if (!id) return acc;

      if (col.meta?.alwaysHidden) {
        acc[id as string] = false;
        return acc;
      }

      const isMobileCard = col.meta?.hideOnDesktop;
      acc[id as string] = isMobileView ? !!isMobileCard : !isMobileCard;
      return acc;
    }, {} as VisibilityState);
  };

  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(
    () => getVisibility(!!useMobileUI),
  );

  // Update visibility when switching between mobile/desktop
  useEffect(() => {
    setColumnVisibility(getVisibility(!!useMobileUI));
  }, [useMobileUI, columns]);

  const derivedConfig = useMemo(() => {
    let search: SearchColumn | undefined;
    const filters: string[] = [];
    const sorts: string[] = [];

    columns.forEach((col) => {
      const id = col.id || (col as any).accessorKey;
      if (!id) return;

      if (col.meta?.filter) filters.push(id);
      if (col.meta?.sort) sorts.push(id);
      if (col.meta?.search) {
        search = {
          column: col.meta.search.searchPath
            ? `${id}.${col.meta.search.searchPath}`
            : id,
          placeholder: col.meta.search.placeholder,
        };
      }
    });

    return { searchColumn: search, filterColumns: filters, sortColumns: sorts };
  }, [columns]);

  const table = useReactTable({
    data,
    columns,
    meta: {
      ...meta,
      isMobile,
    },
    autoResetPageIndex: false,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    onColumnFiltersChange: setColumnFilters,
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: setPagination,
    onRowSelectionChange: setRowSelection,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      pagination,
      rowSelection,
    },
  });

  // Sync selection back to parent
  useEffect(() => {
    if (onSelectedIdsChange) {
      const selectedIndices = Object.keys(rowSelection);
      const selectedDataIds = selectedIndices
        .map((index) => (data[parseInt(index)] as any)?.id)
        .filter(Boolean);

      // Only fire if the arrays are actually different sizes or have different elements
      // to prevent an infinite loop, though React handles basic state equality.
      if (selectedIds) {
        if (
          selectedIds.length === selectedDataIds.length &&
          selectedIds.every((val, index) => val === selectedDataIds[index])
        ) {
          return;
        }
      }
      onSelectedIdsChange(selectedDataIds);
    }
  }, [rowSelection, data, onSelectedIdsChange]);

  // Sync selection FROM parent (e.g. when cleared externally)
  useEffect(() => {
    if (selectedIds) {
      const newRowSelection: Record<string, boolean> = {};
      data.forEach((item, index) => {
        if (selectedIds.includes((item as any).id)) {
          newRowSelection[index] = true;
        }
      });
      setRowSelection(newRowSelection);
    }
  }, [selectedIds, data]);

  const { registerTable } = UseTableRefRegistry();

  useEffect(() => {
    const allFilteredSortedRows = table
      .getSortedRowModel()
      .rows.map((r) => r.original);
    registerTable(tableName, allFilteredSortedRows);
  }, [registerTable, table, tableName]);

  return { table, ...derivedConfig };
}

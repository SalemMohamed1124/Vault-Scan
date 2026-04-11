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
import { UseTableRefRegistry } from "@/Hooks/UseTableRefRegistry";
import { useSidebar } from "@/components/ui/sidebar";
import type { searchColumn as SearchColumn } from "@/components/DataTable/DataTableSearchColumn";

interface UseDataTableProps<TData, TValue> {
  data: TData[];
  columns: ColumnDef<TData, TValue>[];
  tableName: string;
  meta?: TableMeta<TData>;
  columnVisibility?: VisibilityState;
  cardsLayout?: boolean;
  disablePagination?: boolean;
}

export function useDataTable<TData, TValue>({
  data,
  columns,
  tableName,
  meta,
  cardsLayout,
  disablePagination,
}: UseDataTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const { isMobile } = useSidebar();
  const useMobileUI = isMobile || cardsLayout;

  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: disablePagination ? -1 : 10,
  });

  const getVisibility = (isMobileView: boolean) => {
    return columns.reduce((acc, col) => {
      const id = (col as any).accessorKey || col.id;
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

  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(() => getVisibility(!!useMobileUI));

  // Update visibility when switching between mobile/desktop
  useEffect(() => {
    setColumnVisibility(getVisibility(!!useMobileUI));
  }, [useMobileUI, columns]);

  const derivedConfig = useMemo(() => {
    let search: SearchColumn | undefined;
    const filters: string[] = [];
    const sorts: string[] = [];

    columns.forEach((col) => {
      const id = (col as any).accessorKey || col.id;
      if (!id) return;

      if (col.meta?.filter) filters.push(id);
      if (col.meta?.sort) sorts.push(id);
      if (col.meta?.search) {
        search = {
          column: col.meta.search.searchPath ? `${id}.${col.meta.search.searchPath}` : id,
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
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      pagination,
    },
  });

  const { registerTable } = UseTableRefRegistry();

  useEffect(() => {
    const allFilteredSortedRows = table.getSortedRowModel().rows.map((r) => r.original);
    registerTable(tableName, allFilteredSortedRows);
  }, [registerTable, table, tableName]);

  return { table, ...derivedConfig };
}

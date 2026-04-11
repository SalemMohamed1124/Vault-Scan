import type { ColumnDef, TableMeta } from "@tanstack/react-table";
import type { ReactNode } from "react";
import { flexRender } from "@tanstack/react-table";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DataTableToolbar } from "./DataTableToolbar";
import { DataTablePagination } from "./DataTablePagination";
import { Spinner } from "../ui/spinner";
import { useDataTable } from "@/Hooks/useDataTable";
import { useSidebar } from "../ui/sidebar";
import { cn } from "@/lib/utils";

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  meta?: TableMeta<TData>;
  tableName: string;
  isLoading: boolean;
  error?: Error | { message: string } | string | null;
  toolbar?: {
    search?: boolean;
    export?: boolean;
    filter?: boolean;
    viewOptions?: boolean;
  };
  extraActions?: ReactNode;
  cardsLayout?: boolean;
  disablePagination?: boolean;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  meta,
  tableName,
  isLoading,
  error,
  toolbar = { search: true, export: true, filter: true, viewOptions: true },
  extraActions,
  cardsLayout = false,
  disablePagination = false,
}: DataTableProps<TData, TValue>) {
  const { table, searchColumn, filterColumns, sortColumns } = useDataTable({
    data,
    columns,
    tableName,
    meta,
    cardsLayout,
    disablePagination,
  });
  const { isMobile } = useSidebar();
  const useMobileUI = isMobile || cardsLayout;

  return (
    <div>
      <DataTableToolbar
        table={table}
        searchColumn={searchColumn}
        filterColumns={filterColumns}
        sortColumns={sortColumns}
        tableName={tableName}
        toolbar={toolbar}
        extraActions={extraActions}
        cardsLayout={cardsLayout}
      />

      <div className="rounded-md mt-2">
        <Table className={cn("w-full border-separate", cardsLayout ? "border-spacing-y-3" : "border-spacing-0")}>
          {!useMobileUI && (
            <TableHeader className="sticky top-15 z-10 w-full bg-background">
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => {
                    return (
                      <TableHead
                        key={header.id}
                        className={cn(header.id === "actions" && "w-20 ", header.column.columnDef.meta?.className)}
                      >
                        {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                      </TableHead>
                    );
                  })}
                </TableRow>
              ))}
            </TableHeader>
          )}
          <TableBody className={cn(useMobileUI && "flex flex-col gap-3")}>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className={cn(useMobileUI && "block w-full border-none")}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className={cn(
                        useMobileUI && "block w-full p-0 border-none sm:border-none",
                        cell.column.columnDef.meta?.className
                      )}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className={cn("h-24", useMobileUI && "flex items-center justify-center")}>
                  {isLoading ? (
                    <div className="flex h-full w-full items-center justify-center">
                      <Spinner />
                    </div>
                  ) : error ? (
                    <div className="text-center text-destructive">{error.toString()}</div>
                  ) : (
                    <div className="text-center text-muted-foreground">No Results Found</div>
                  )}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      {!disablePagination && (
        <div className={cn("mt-5", useMobileUI && "flex justify-center")}>
          <DataTablePagination table={table} />
        </div>
      )}
    </div>
  );
}

import type { Table } from "@tanstack/react-table";
import type { ReactNode } from "react";
import DataTableSearchColumn from "./DataTableSearchColumn";
import { DataTableFilterBar } from "./DataTableFilterBar";
import DataTableViewOptions from "./DataTableViewOptions";
import TableExporter from "./DataTableExporter";
import type { searchColumn } from "./DataTableSearchColumn";
import DataTableSortFilterModal from "./DataTableSortFilterModal";
import { useSidebar } from "../ui/sidebar";

interface DataTableToolbarProps<TData> {
  table: Table<TData>;
  searchColumn?: searchColumn;
  filterColumns?: string[];
  sortColumns?: string[]; // Added for SortFilterModal
  tableName: string;
  toolbar?: {
    search?: boolean;
    export?: boolean;
    filter?: boolean;
    viewOptions?: boolean;
  };
  extraActions?: ReactNode;
  cardsLayout?: boolean;
}

export function DataTableToolbar<TData>({
  table,
  searchColumn,
  filterColumns,
  sortColumns,
  tableName,
  toolbar = { search: true, export: true, filter: true, viewOptions: true },
  extraActions,
  cardsLayout,
}: DataTableToolbarProps<TData>) {
  const { isMobile } = useSidebar();
  const showSearch = toolbar.search && searchColumn;
  const showFilter =
    toolbar.filter && filterColumns && filterColumns.length > 0;
  const showExport = toolbar.export;
  const showViewOptions = toolbar.viewOptions;

  if (
    !showSearch &&
    !showFilter &&
    !showExport &&
    !showViewOptions &&
    !extraActions
  )
    return null;

  return (
    <div className="flex flex-col md:flex-row md:items-center gap-4 sticky top-0 z-20 py-3 bg-background">
      {isMobile ? (
        <div className="flex flex-col gap-2 w-full">
          <div className="flex flex-col gap-2 w-full ">
            {extraActions && extraActions}
            <div className="flex gap-2 w-full *:flex-1 flex-row flex-wrap">
              {showExport && (
                <TableExporter table={table} fileName={tableName} />
              )}
              <DataTableSortFilterModal
                table={table}
                sortColumns={sortColumns}
                filterColumns={toolbar.filter ? filterColumns : []}
              />
            </div>
          </div>
          {showSearch && (
            <DataTableSearchColumn table={table} searchColumn={searchColumn} />
          )}
        </div>
      ) : (
        <div className="flex items-center space-x-4 w-full">
          {showSearch && (
            <DataTableSearchColumn table={table} searchColumn={searchColumn} />
          )}
          {showFilter && !cardsLayout && (
            <DataTableFilterBar table={table} columns={filterColumns} />
          )}
          <div className="ml-auto flex items-center space-x-4">
            {cardsLayout && (
              <DataTableSortFilterModal
                table={table}
                sortColumns={sortColumns}
                filterColumns={toolbar.filter ? filterColumns : []}
              />
            )}
            {showViewOptions && !cardsLayout && (
              <DataTableViewOptions table={table} />
            )}
            {showExport && !cardsLayout && (
              <TableExporter table={table} fileName={tableName} />
            )}
            {extraActions && (
              <div className="flex items-center">{extraActions}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

import type { Table } from "@tanstack/react-table";
import React, { createContext, useContext } from "react";

export type SortFilterContextValue = {
  sortColumn: string | null;
  setSortColumn: (val: string | null) => void;
  sortOrder: "asc" | "desc";
  setSortOrder: (val: "asc" | "desc") => void;
  filters: Record<string, Set<string>>;
  toggleFilterValue: (columnId: string, value: string) => void;
  uniqueValues: Record<string, string[]>;
  applyChanges: () => void;
  resetAll: () => void;
  sortColumns: string[];
  filterColumns: string[];
};

export type SortFilterContextProps = SortFilterContextValue;

export const SortFilterModalContext = createContext<SortFilterContextProps | null>(null);

export function useSortFilterState<TData>({
  table,
  sortColumns,
  filterColumns,
  isOpen,
  onClose,
}: {
  table: Table<TData>;
  sortColumns: string[];
  filterColumns: string[];
  isOpen: boolean;
  onClose: () => void;
}): SortFilterContextValue {
  const [sortColumn, setSortColumn] = React.useState<string | null>(null);
  const [sortOrder, setSortOrder] = React.useState<"asc" | "desc">("asc");
  const [filters, setFilters] = React.useState<Record<string, Set<string>>>({});

  // Sync with actual table state whenever modal opens
  React.useEffect(() => {
    if (isOpen) {
      const currentSort = table.getState().sorting[0];
      setSortColumn(currentSort?.id || null);
      setSortOrder(currentSort?.desc ? "desc" : "asc");

      const currentFilters = table.getState().columnFilters;
      const newFilters: Record<string, Set<string>> = {};
      currentFilters.forEach((f) => {
        if (Array.isArray(f.value)) newFilters[f.id] = new Set(f.value.map(String));
      });
      setFilters(newFilters);
    }
  }, [isOpen, table]);

  const uniqueValues = React.useMemo(() => {
    const result: Record<string, string[]> = {};
    filterColumns.forEach((col) => {
      const column = table.getColumn(col);
      if (!column) return;
      const values = new Set<string>();
      table.getPreFilteredRowModel().rows.forEach((row) => {
        const value = row.getValue(col);
        if (value !== undefined && value !== null) values.add(String(value));
      });
      result[col] = Array.from(values).sort();
    });
    return result;
  }, [table, filterColumns]);

  const toggleFilterValue = (columnId: string, value: string) => {
    setFilters((prev) => {
      const current = new Set(prev[columnId] ?? []);
      if (current.has(value)) {
        current.delete(value);
      } else {
        current.add(value);
      }
      return { ...prev, [columnId]: current };
    });
  };

  const applyChanges = () => {
    if (sortColumn) {
      table.setSorting([{ id: sortColumn, desc: sortOrder === "desc" }]);
    } else {
      table.resetSorting();
    }

    filterColumns.forEach((col) => table.getColumn(col)?.setFilterValue(undefined));
    Object.entries(filters).forEach(([id, vals]) => {
      table.getColumn(id)?.setFilterValue(vals.size ? Array.from(vals) : undefined);
    });
    onClose();
  };

  const resetAll = () => {
    setSortColumn(null);
    setSortOrder("asc");
    setFilters({});
    table.resetSorting();
    table.resetColumnFilters();
  };

  return {
    sortColumn,
    setSortColumn,
    sortOrder,
    setSortOrder,
    filters,
    toggleFilterValue,
    uniqueValues,
    applyChanges,
    resetAll,
    sortColumns,
    filterColumns,
  };
}

// --- Provider ---
export function SortFilterModalProvider<TData>(props: {
  children: React.ReactNode;
  table: Table<TData>;
  sortColumns: string[];
  filterColumns: string[];
  isOpen: boolean;
  onClose: () => void;
}) {
  const value = useSortFilterState(props);
  return <SortFilterModalContext.Provider value={value}>{props.children}</SortFilterModalContext.Provider>;
}

export const useSortFilter = () => {
  const context = useContext(SortFilterModalContext);
  if (!context) throw new Error("useSortFilterContext must be used within Provider");
  return context;
};

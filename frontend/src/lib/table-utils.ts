import type { Row } from "@tanstack/react-table";

/**
 * Faceted filter function for TanStack Table.
 * Supports multi-value filtering (e.g., select multiple statuses).
 */
export function facetedFilter<TData>(
  row: Row<TData>,
  columnId: string,
  filterValues: string[]
): boolean {
  if (!filterValues || filterValues.length === 0) return true;
  const cellValue = row.getValue(columnId);

  if (Array.isArray(cellValue)) {
    return cellValue.some((v: unknown) =>
      filterValues.includes(String(v))
    );
  }

  return filterValues.includes(String(cellValue));
}

// TanStack Table type augmentation for custom column meta
import "@tanstack/react-table";

declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    /** Custom class name for the column */
    className?: string;
    /** Column should be hidden on desktop but shown on mobile (for MobileCard) */
    hideOnDesktop?: boolean;
    /** Column should always be hidden (never visible) */
    alwaysHidden?: boolean;
    /** Enable faceted filter for this column */
    filter?: boolean;
    /** Enable sorting for this column */
    sort?: boolean;
    /** Enable search on this column */
    search?: {
      placeholder?: string;
      searchPath?: string;
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface TableMeta<TData extends RowData> {
    /** Whether the table is being viewed on mobile */
    isMobile?: boolean;
  }
}

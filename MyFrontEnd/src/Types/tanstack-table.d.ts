import "@tanstack/react-table";

declare module "@tanstack/react-table" {
  interface ColumnMeta {
    className?: string;
    hideOnDesktop?: boolean;
    alwaysHidden?: boolean;
    filter?: boolean;
    sort?: boolean;
    search?: { placeholder?: string; searchPath?: string };
  }
}

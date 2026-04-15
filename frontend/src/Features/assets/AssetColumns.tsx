import type { ColumnDef } from "@tanstack/react-table";
import type { Asset } from "@/types";
import { DataTableColumnHeader } from "@/components/dataTable/DataTableColumnHeader";
import { SeverityBadge } from "@/components/layout/SeverityBadge";
import { formatRelativeTime } from "@/lib/utils";
import AssetRowActions from "./AssetRowActions";
import AssetMobileCard from "./AssetMobileCard";

const typeConfig = {
  DOMAIN: { label: "Domain", theme: "INFORMATIVE" as const },
  IP: { label: "IP Address", theme: "OUTLINE_SECONDARY" as const },
  URL: { label: "URL", theme: "LOW" as const },
  CIDR: { label: "CIDR Range", theme: "HIGH" as const },
};

export const AssetColumns: ColumnDef<Asset>[] = [
  {
    id: "card",
    meta: { hideOnDesktop: true, className: "p-0" },
    cell: ({ row }) => <AssetMobileCard asset={row.original} />,
  },
  {
    accessorKey: "name",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Name" />
    ),
    cell: ({ row }) => (
      <div
        className="max-w-[180px] truncate font-bold text-sm tracking-tight"
        title={row.getValue("name")}
      >
        {row.getValue("name")}
      </div>
    ),
    meta: {
      sort: true,
      search: { placeholder: "Search by name..." },
    },
  },
  {
    accessorKey: "value",
    header: "Value",
    cell: ({ row }) => (
      <div
        className="max-w-[220px] truncate text-[11px] font-mono text-muted-foreground"
        title={row.getValue("value")}
      >
        {row.getValue("value")}
      </div>
    ),
  },
  {
    accessorKey: "type",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Type" />
    ),
    cell: ({ row }) => {
      const type = row.getValue("type") as Asset["type"];
      const config = typeConfig[type];
      return <SeverityBadge theme={config?.theme}>{config?.label}</SeverityBadge>;
    },
    meta: {
      filter: true,
    },
    filterFn: "arrIncludesSome",
  },
  {
    accessorKey: "createdAt",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Created At" />
    ),
    cell: ({ row }) => (
      <div className="text-xs text-muted-foreground font-medium">
        {formatRelativeTime(row.getValue("createdAt"))}
      </div>
    ),
    meta: {
      sort: true,
    },
    sortingFn: "datetime",
  },
  {
    accessorKey: "updatedAt",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Updated At" />
    ),
    cell: ({ row }) => (
      <div className="text-xs text-muted-foreground font-medium">
        {formatRelativeTime(row.getValue("updatedAt"))}
      </div>
    ),
    meta: {
      sort: true,
    },
    sortingFn: "datetime",
  },
  {
    id: "actions",
    header: "Actions",
    cell: ({ row }) => <AssetRowActions asset={row.original} />,
  },
];



import type { ColumnDef } from "@tanstack/react-table";
import type { Port, Severity } from "@/Types/data-types";

import { Badge } from "@/components/Customized/badge";
import { Lock, Unlock, Calendar } from "lucide-react";
import { facetedFilter, sortSeverity } from "@/lib/utils";
import { sortLastScan } from "@/lib/schedule-utils";
import { format, parseISO } from "date-fns";
import PortMobileCard from "@/Features/AttackSurface/Ports/PortMobileCard";
import { DataTableColumnHeader } from "@/components/DataTable/DataTableColumnHeader";
import PortRowActions from "@/Features/AttackSurface/Ports/PortRowActions";

export const PortsColumns: ColumnDef<Port>[] = [
  {
    id: "card",
    meta: { hideOnDesktop: true, className: "p-0" },
    cell: ({ row }) => <PortMobileCard port={row.original} />,
  },
  {
    accessorKey: "value",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Port" />,
    meta: { search: { placeholder: "Search by Port" } },
    cell: ({ row }) => {
      const port = row.original;
      const status = port.status;

      return (
        <div className="flex items-center gap-2 font-medium">
          {status === "open" && <Unlock className="size-3.5 text-red-500" />}
          {status === "filtered" && <Lock className="size-3.5 text-orange-500" />}
          {status === "closed" && <Lock className="size-3.5 text-green-500" />}
          <span>{port.value}</span>
        </div>
      );
    },
  },
  {
    accessorKey: "protocol",
    header: "Protocol",
    meta: { filter: true },
    cell: ({ row }) => (
      <Badge variant="secondary" className="font-mono text-[10px] px-1.5 py-0 leading-none h-4">
        {row.getValue("protocol")}
      </Badge>
    ),
    filterFn: facetedFilter,
  },
  {
    accessorKey: "service",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Service" />,
    meta: { filter: true, sort: true },
    filterFn: facetedFilter,
  },
  {
    meta: {
      className: "hidden",
    },
    accessorKey: "ipAddress",
    header: "IP Address",
    cell: ({ row }) => <Badge variant="outline">{row.getValue("ipAddress")}</Badge>,
  },
  {
    accessorKey: "status",
    header: "Status",
    filterFn: facetedFilter,

    cell: ({ row }) => {
      const status = row.getValue("status") as string;
      let theme: Severity;
      if (status === "Open") theme = "critical";
      else if (status === "Filtered") theme = "medium";
      else if (status === "Closed") theme = "none";
      else theme = "none";
      return <Badge theme={theme}>{status}</Badge>;
    },
  },
  {
    accessorKey: "banner",
    header: "Banner",
    meta: { className: "hidden xl:table-cell" },
    cell: ({ row }) => (
      <div className="text-muted-foreground truncate font-mono text-sm" title={row.getValue("banner")}>
        {row.getValue("banner")}
      </div>
    ),
  },
  {
    accessorKey: "lastScan",
    header: "Last Scan",
    sortingFn: (rowA, rowB) => sortLastScan(rowA.original.lastScan, rowB.original.lastScan),
    meta: { className: "hidden lg:table-cell" },
    cell: ({ row }) => {
      const date = row.getValue("lastScan") as string;
      return (
        <Badge variant="outline" className="flex gap-2 p-0 w-fit items-center border-none bg-transparent">
          <Calendar className="size-4" />
          <span className="text-sm">{date ? format(parseISO(date), "PPP") : "Never"}</span>
        </Badge>
      );
    },
  },
  {
    accessorKey: "vulnerabilities",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Vulnerabilities" />,
    meta: { sort: true },
    cell: ({ row }) => <div>{row.getValue("vulnerabilities")}</div>,
  },
  {
    accessorKey: "severity",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Severity" />,
    sortingFn: (rowA, rowB) => sortSeverity(rowA.original.severity, rowB.original.severity),
    meta: { filter: true, sort: true },
    cell: ({ row }) => {
      const severity = row.getValue("severity") as Severity;

      return <Badge theme={severity}>{severity}</Badge>;
    },
    filterFn: facetedFilter,
  },

  {
    id: "actions",
    header: "Actions",
    meta: { className: "w-20" },

    cell: ({ row }) => {
      const port = row.original;
      return <PortRowActions port={port} />;
    },
  },
];

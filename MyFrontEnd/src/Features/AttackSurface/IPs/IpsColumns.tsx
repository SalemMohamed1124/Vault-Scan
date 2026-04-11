import type { ColumnDef } from "@tanstack/react-table";
import type { Ip, Severity } from "@/Types/data-types";
import { DataTableColumnHeader } from "../../../components/DataTable/DataTableColumnHeader";
import IpMobileCard from "./IpMobileCard";
import IpRowActions from "./IpRowActions";
import { MapPin, Calendar } from "lucide-react";
import { format, parseISO } from "date-fns";
import { Badge } from "@/components/Customized/badge";
import { facetedFilter, sortSeverity } from "@/lib/utils";

export const IpsColumns: ColumnDef<Ip>[] = [
  {
    id: "card",
    meta: { hideOnDesktop: true, className: "p-0" },
    cell: ({ row }) => <IpMobileCard ip={row.original} />,
  },

  {
    accessorKey: "value",
    header: "IP Address",
    meta: { search: { placeholder: "Search by IP Address" } },
    cell: ({ row }) => <div className="font-medium">{row.getValue("value")}</div>,
  },
  {
    accessorKey: "hostname",
    header: "Hostname",
    cell: ({ row }) => <div className="text-muted-foreground truncate">{row.getValue("hostname")}</div>,
  },
  {
    accessorKey: "location",
    header: "Location",
    filterFn: facetedFilter,
    meta: { filter: true },

    cell: ({ row }) => (
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <MapPin className="size-3.5" />
        <span>{row.getValue("location")}</span>
      </div>
    ),
  },
  {
    accessorKey: "openPorts",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Open Ports" />,
    meta: { className: "hidden xl:table-cell", sort: true },
    cell: ({ row }) => <div>{row.getValue("openPorts")}</div>,
  },
  {
    accessorKey: "services",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Services" />,
    meta: { className: "hidden xl:table-cell", sort: true },
    cell: ({ row }) => <div>{row.getValue("services")}</div>,
  },
  {
    accessorKey: "lastScan",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Last Scan" />,
    sortingFn: "datetime",
    meta: { className: "hidden lg:table-cell", sort: true },
    cell: ({ row }) => {
      const lastScan = row.getValue("lastScan") as string;
      return (
        <Badge variant="outline" className="flex gap-2 p-0 w-fit items-center border-none bg-transparent ">
          <Calendar className="size-4" />
          <span className="text-sm">{lastScan ? format(parseISO(lastScan), "PPP") : "Never"}</span>
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
      const ip = row.original;
      return <IpRowActions ip={ip} />;
    },
  },
];

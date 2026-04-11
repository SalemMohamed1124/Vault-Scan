import type { ColumnDef } from "@tanstack/react-table";
import type { Scan, Severity } from "@/Types/data-types";
import { DataTableColumnHeader } from "../../../../components/DataTable/DataTableColumnHeader";
import ScanMobileCard from "./ScanMobileCard";
import ScanRowActions from "./ScanRowActions";
import { Clock, Zap } from "lucide-react";
import { format, parseISO } from "date-fns";
import { Badge } from "@/components/Customized/badge";
import { facetedFilter, sortSeverity } from "@/lib/utils";

export const ScanColumns: ColumnDef<Scan>[] = [
  {
    id: "card",
    meta: { hideOnDesktop: true, className: "p-0" },
    cell: ({ row }) => <ScanMobileCard scan={row.original} />,
  },

  {
    accessorKey: "asset",
    header: "Asset",
    meta: { search: { placeholder: "Search by asset", searchPath: "value" } },
    cell: ({ row }) => {
      const scan = row.original;
      return <div className="font-medium truncate">{scan.asset.value}</div>;
    },
  },
  {
    accessorKey: "scanType",
    header: "Scan Type",
    filterFn: facetedFilter,
    meta: { filter: true },
    cell: ({ row }) => {
      const scanType = row.getValue("scanType") as string;

      return <div className="capitalize">{scanType}</div>;
    },
  },
  {
    accessorKey: "status",
    header: "Status",
    filterFn: facetedFilter,
    meta: { filter: true },
    cell: ({ row }) => {
      const status = row.getValue("status") as string;
      const statusVariant =
        status == "completed" ? "none" : status == "failed" ? "critical" : status == "running" ? "low" : "outlineSecondary";

      return <Badge theme={statusVariant}>{status}</Badge>;
    },
  },
  {
    accessorKey: "startTime",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Start Time" />,
    sortingFn: "datetime",
    meta: { className: "hidden lg:table-cell", sort: true },
    cell: ({ row }) => {
      const startTime = row.getValue("startTime") as string;
      return (
        <Badge variant="outline" className="flex gap-2 p-0 w-fit items-center border-none bg-transparent ">
          <Clock className="size-4" />
          <span className="text-sm">{startTime ? format(parseISO(startTime), "PPP p") : "-"}</span>
        </Badge>
      );
    },
  },
  {
    accessorKey: "duration",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Duration" />,
    sortingFn: "alphanumeric",
    meta: { className: "hidden xl:table-cell", sort: true },
    cell: ({ row }) => (
      <div className="flex items-center gap-1.5">
        <Zap className="size-3.5" />
        <span>{row.getValue("duration")}</span>
      </div>
    ),
  },
  {
    accessorKey: "vulnerabilitiesFound",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Vulnerabilities" />,
    meta: { sort: true },
    cell: ({ row }) => <div>{row.getValue("vulnerabilitiesFound")}</div>,
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
    accessorKey: "triggerType",
    header: "Trigger Type",
    filterFn: facetedFilter,
    meta: { filter: true, className: "hidden lg:table-cell" },
    cell: ({ row }) => <div className="text-muted-foreground capitalize">{row.getValue("triggerType")}</div>,
  },

  {
    id: "actions",
    header: "Actions",
    meta: { className: "w-20" },
    cell: ({ row }) => {
      const scan = row.original;
      return <ScanRowActions scan={scan} />;
    },
  },
];

import type { ColumnDef } from "@tanstack/react-table";
import { DataTableColumnHeader } from "@/components/DataTable/DataTableColumnHeader";
import VulnerabilityFixedRowActions from "./VulnerabilityFixedRowActions";
import type { Severity, Vulnerability } from "@/Types/data-types";
import { CheckCircle2, Calendar, User } from "lucide-react";
import { Badge } from "@/components/Customized/badge";
import { facetedFilter, sortSeverity } from "@/lib/utils";
import { sortLastScan } from "@/lib/schedule-utils";
import { format, parseISO } from "date-fns";
import VulnerabilityFixedMobileCard from "./VulnerabilityFixedMobileCard";

export const VulnerabilitiesFixedColumns: ColumnDef<Vulnerability>[] = [
  {
    id: "card",
    meta: { hideOnDesktop: true, className: "p-0" },
    cell: ({ row }) => <VulnerabilityFixedMobileCard vulnerability={row.original} />,
  },
  {
    accessorKey: "title",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Title" />,
    cell: ({ row }) => (
      <div className="flex items-center gap-2 font-medium">
        <Badge theme="none" className="border-none p-0 bg-transparent ">
          <CheckCircle2 className="size-4 shrink-0" />
        </Badge>
        <div className="truncate ">{row.getValue("title")}</div>
      </div>
    ),
  },
  {
    accessorKey: "cveId",
    meta: { search: { placeholder: "search by CVE ID" } },
    header: ({ column }) => <DataTableColumnHeader column={column} title="CVE ID" />,
    cell: ({ row }) => <Badge theme="outlineSecondary">{row.getValue("cveId")}</Badge>,
  },

  {
    accessorKey: "asset",
    header: "Asset",
    cell: ({ row }) => {
      const asset = row.original.asset.value;
      return <div className="text-muted-foreground truncate">{asset}</div>;
    },
  },
  {
    accessorKey: "category",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Category" />,
    meta: { filter: true },
    cell: ({ row }) => <Badge theme="informative">{row.getValue("category")}</Badge>,
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
    accessorKey: "discovered",
    sortingFn: (rowA, rowB) => sortLastScan(rowA.original.discovered, rowB.original.discovered),
    header: ({ column }) => <DataTableColumnHeader column={column} title="Discovered" />,
    meta: { sort: true },
    cell: ({ row }) => {
      const date = row.getValue("discovered") as string;
      return (
        <Badge variant="outline" className="flex gap-2 p-0 w-fit items-center border-none bg-transparent">
          <Calendar className="size-4" />
          <span className="text-sm">{date ? format(parseISO(date), "PPP") : "Never"}</span>
        </Badge>
      );
    },
  },
  {
    accessorKey: "fixedDate",
    sortingFn: (rowA, rowB) => sortLastScan(rowA.original.fixedDate, rowB.original.fixedDate),
    header: ({ column }) => <DataTableColumnHeader column={column} title="Fixed Date" />,
    meta: { sort: true },
    cell: ({ row }) => {
      const date = row.getValue("fixedDate") as string;
      return (
        <Badge variant="outline" className="flex gap-2 p-0 w-fit items-center border-none bg-transparent">
          <Calendar className="size-4" />
          <span className="text-sm">{date ? format(parseISO(date), "PPP") : "Never"}</span>
        </Badge>
      );
    },
  },
  {
    accessorKey: "fixedBy",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Fixed By" />,
    cell: ({ row }) => (
      <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium">
        <User className="size-3.5 text-blue-500" />
        <span>{row.getValue("fixedBy")}</span>
      </div>
    ),
  },
  {
    id: "actions",
    header: "Actions",
    meta: { className: "w-20" },

    cell: ({ row }) => <VulnerabilityFixedRowActions vulnerability={row.original} />,
  },
];

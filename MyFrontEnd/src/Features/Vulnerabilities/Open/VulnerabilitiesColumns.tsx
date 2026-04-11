import type { ColumnDef } from "@tanstack/react-table";
import type { Severity, Vulnerability } from "@/Types/data-types";
import { DataTableColumnHeader } from "@/components/DataTable/DataTableColumnHeader";
import VulnerabilityRowActions from "./VulnerabilityRowActions";
import { AlertTriangle, Calendar } from "lucide-react";
import { Badge } from "@/components/Customized/badge";
import { facetedFilter, sortSeverity } from "@/lib/utils";
import { sortLastScan } from "@/lib/schedule-utils";
import { format, parseISO } from "date-fns";
import VulnerabilityMobileCard from "./VulnerabilityMobileCard";

export const VulnerabilitiesColumns: ColumnDef<Vulnerability>[] = [
  {
    id: "card",
    meta: { hideOnDesktop: true, className: "p-0" },
    cell: ({ row }) => <VulnerabilityMobileCard vulnerability={row.original} />,
  },
  {
    accessorKey: "title",
    header: "Title",
    cell: ({ row }) => {
      const severity = row.getValue("severity") as Severity;
      return (
        <div className="flex items-center gap-2 font-medium">
          <Badge theme={severity} className="border-none p-0 bg-transparent ">
            <AlertTriangle className="size-4 shrink-0" />
          </Badge>
          <span className="truncate">{row.getValue("title")}</span>
        </div>
      );
    },
  },
  {
    accessorKey: "cveId",
    header: "CVE ID",
    meta: { search: { placeholder: "search by CVE ID" } },

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
    header: "Category",
    filterFn: "arrIncludesSome",
    meta: { filter: true },
    cell: ({ row }) => <Badge theme={"informative"}>{row.getValue("category")}</Badge>,
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
    accessorKey: "cvss",
    header: ({ column }) => <DataTableColumnHeader column={column} title="CVSS" />,
    meta: { sort: true },
    cell: ({ row }) => {
      const cvss = row.getValue("cvss") as number;
      let theme: Severity;
      if (cvss == 10 || cvss >= 9) theme = "critical";
      else if (cvss == 8.9 || cvss >= 7) theme = "high";
      else if (cvss == 6.9 || cvss >= 4) theme = "medium";
      else if (cvss == 3.9 || cvss >= 0.1) theme = "low";
      else theme = "none";

      return <Badge theme={theme}>{cvss.toFixed(1)}</Badge>;
    },
  },
  {
    accessorKey: "discovered",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Discovered" />,
    sortingFn: (rowA, rowB) => sortLastScan(rowA.original.discovered, rowB.original.discovered),
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
    id: "actions",
    header: "Actions",
    meta: { className: "w-20" },
    cell: ({ row }) => <VulnerabilityRowActions vulnerability={row.original} />,
  },
];

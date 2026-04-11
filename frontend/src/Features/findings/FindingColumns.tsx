"use client";

import type { ColumnDef } from "@tanstack/react-table";
import type { ScanFinding, Severity } from "@/types";
import { DataTableColumnHeader } from "@/components/dataTable/DataTableColumnHeader";
import { SeverityBadge } from "@/components/layout/SeverityBadge";
import { Bug } from "lucide-react";
import FindingMobileCard from "./FindingMobileCard";
import FindingRowActions from "./FindingRowActions";
import { Checkbox } from "@/components/ui/checkbox";

const severityConfig: Record<Severity, { theme: "critical" | "high" | "medium" | "low" | "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" }> = {
  CRITICAL: { theme: "CRITICAL" },
  HIGH: { theme: "HIGH" },
  MEDIUM: { theme: "MEDIUM" },
  LOW: { theme: "LOW" },
};

export const FindingColumns: ColumnDef<ScanFinding>[] = [
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() && "indeterminate")
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all"
        className="translate-y-[2px]"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Select row"
        className="translate-y-[2px]"
      />
    ),
    enableSorting: false,
    enableHiding: false,
    meta: { className: "w-10 px-4" },
  },
  {
    id: "mobile",
    cell: ({ row }) => <FindingMobileCard finding={row.original} />,
    meta: { hideOnDesktop: true },
  },
  {
    id: "vulnerability",
    accessorFn: (row) => row.vulnerability?.name,
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Vulnerability" />
    ),
    cell: ({ row }) => {
      const theme =
        severityConfig[row.original.vulnerability?.severity as Severity].theme;

      return (
        <div className="flex items-center gap-2.5">
          <div className="flex flex-col min-w-0">
            <span className="font-bold text-[13px] text-foreground truncate max-w-[200px]">
              {row.original.vulnerability?.name || "Unknown"}
            </span>
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-60">
              {row.original.vulnerability?.category || "uncategorized"}
            </span>
          </div>
        </div>
      );
    },
    meta: { search: { placeholder: "Search vulnerabilities..." } },
  },
  {
    id: "riskLevel",
    accessorFn: (row) => row.vulnerability?.severity,
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Risk Level" />
    ),
    cell: ({ row }) => {
      const severity = row.original.vulnerability?.severity as Severity;
      const config = severityConfig[severity] || severityConfig.LOW;
      return <SeverityBadge theme={config.theme}>{severity}</SeverityBadge>;
    },
    meta: { filter: true, sort: true },
    filterFn: "arrIncludesSome",
  },

  {
    id: "category",
    accessorFn: (row) => row.vulnerability?.category,
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Category" />
    ),
    cell: ({ row }) => (
      <SeverityBadge theme="OUTLINE_SECONDARY">
        {row.original.vulnerability?.category}
      </SeverityBadge>
    ),
    meta: { filter: true, className: "hidden xl:table-cell" },
    filterFn: "arrIncludesSome",
  },
  {
    id: "target",
    header: "Target Entity",
    cell: ({ row }) => {
      const asset = row.original.scan?.asset;
      return (
        <div className="flex flex-col">
          <span className="font-bold text-[12px] text-foreground">
            {asset?.name || "N/A"}
          </span>
          <span className="text-[10px] font-mono text-muted-foreground opacity-70">
            {row.original.location || asset?.value}
          </span>
        </div>
      );
    },
  },
  {
    id: "actions",
    header: "Actions",
    cell: ({ row }) => <FindingRowActions finding={row.original} />,
  },
];



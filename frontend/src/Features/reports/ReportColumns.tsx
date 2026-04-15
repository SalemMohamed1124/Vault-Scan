"use client";

import type { ColumnDef } from "@tanstack/react-table";
import type { Report } from "@/types";
import { DataTableColumnHeader } from "@/components/dataTable/DataTableColumnHeader";
import { SeverityBadge } from "@/components/layout/SeverityBadge";
import { FileJson, Globe, File } from "lucide-react";
import { formatDateTime, formatRelativeTime } from "@/lib/utils";
import ReportMobileCard from "./ReportMobileCard";
import ReportRowActions from "./ReportRowActions";
import { cn } from "@/lib/utils";

const FORMAT_META: Record<string, any> = {
  PDF: { icon: File, theme: "HIGH" },
  JSON: {
    icon: FileJson,
    theme: "MEDIUM",
  },
  HTML: {
    icon: Globe,
    theme: "LOW",
  },
};

export const ReportColumns: ColumnDef<Report>[] = [
  {
    id: "mobile",
    cell: ({ row }) => <ReportMobileCard report={row.original} />,
    meta: { hideOnDesktop: true, className: "p-0" },
  },
  {
    accessorKey: "format",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Format" />
    ),
    cell: ({ row }) => {
      const format = row.getValue("format") as string;
      const meta = FORMAT_META[format] ?? FORMAT_META.PDF;
      const Icon = meta.icon;
      return (
        <SeverityBadge
          theme={meta.theme}
          className={cn(
            "text-[10px] font-bold uppercase py-0.5 px-2 gap-1.5 border",
            meta.color,
          )}
        >
          <Icon className="size-3" />
          {format}
        </SeverityBadge>
      );
    },
    meta: { filter: true },
    filterFn: "arrIncludesSome",
  },
  {
    id: "Asset",
    accessorFn: (row) => row.scan?.asset?.name || "Unknown Asset",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Asset" />
    ),
    cell: ({ row }) => (
      <div className="flex flex-col max-w-[200px]">
        <span className="text-sm font-bold tracking-tight truncate">
          {row.getValue("Asset")}
        </span>
      </div>
    ),
    meta: {
      sort: true,
      search: { placeholder: "Search by asset..." },
    },
  },
  {
    id: "createdAt",
    accessorKey: "createdAt",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Created At" />
    ),
    cell: ({ row }) => (
      <div className="flex flex-col">
        <span className="text-xs font-bold text-foreground">
          {formatRelativeTime(row.getValue("createdAt"))}
        </span>
      </div>
    ),
    meta: { sort: true },
    sortingFn: "datetime",
  },
  {
    id: "expiresAt",
    accessorKey: "expiresAt",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Expires At" />
    ),
    cell: ({ row }) => {
      const isExpired = new Date(row.original.expiresAt) < new Date();
      return (
        <div className="flex items-center gap-2">
          <SeverityBadge
            theme={isExpired ? "critical" : "none"}
            className={cn(
              "text-[9px] font-black uppercase py-0.5 px-2",
              !isExpired &&
                "bg-muted/30 text-muted-foreground border-border/10",
            )}
          >
            {isExpired ? "EXPIRED" : "VALID"}
          </SeverityBadge>
          {!isExpired && (
            <span className="text-[10px] font-bold text-muted-foreground opacity-60">
              {formatDateTime(row.original.expiresAt).split(",")[0]}
            </span>
          )}
        </div>
      );
    },
  },
  {
    id: "actions",
    header: "Actions",
    cell: ({ row }) => <ReportRowActions report={row.original} />,
  },
];

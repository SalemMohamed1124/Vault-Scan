"use client";

import type { ColumnDef } from "@tanstack/react-table";
import type { Scan, ScanStatus, ScanType, Severity } from "@/types";
import { DataTableColumnHeader } from "@/components/dataTable/DataTableColumnHeader";
import { SeverityBadge } from "@/components/layout/SeverityBadge";
import { formatRelativeTime, formatDuration, severityDot } from "@/lib/utils";
import { CheckCircle2, Loader2, XCircle, Clock, Ban } from "lucide-react";
import ScanMobileCard from "./ScanMobileCard";
import ScanRowActions from "./ScanRowActions";

import { SCAN_STATUS_CONFIG } from "./scan-status-config";

export const ScanColumns: ColumnDef<Scan>[] = [
  {
    id: "card",
    cell: ({ row }) => <ScanMobileCard scan={row.original} />,
    meta: { hideOnDesktop: true, className: "p-0" },
  },
  {
    id: "asset",
    accessorKey: "asset",
    accessorFn: (row) => row.asset?.name || row.asset?.value,
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Target Asset" />
    ),
    cell: ({ row }) => {
      const asset = row.original.asset;
      return (
        <div
          className="flex flex-col max-w-[200px] truncate"
          title={asset?.name || row.original.assetId}
        >
          <span className="font-bold text-sm tracking-tight text-foreground truncate">
            {asset?.name || row.original.assetId.slice(0, 8)}
          </span>
          <span className="text-[10px] font-mono text-muted-foreground opacity-60 truncate">
            {asset?.value || "N/A"}
          </span>
        </div>
      );
    },
    meta: {
      sort: true,
      search: { placeholder: "search assets..." },
    },
  },
  {
    id: "type",
    accessorKey: "type",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Scan Type" />
    ),
    cell: ({ row }) => {
      const type = row.getValue("type") as ScanType;
      return (
        <SeverityBadge theme={type === "DEEP" ? "INFORMATIVE" : "OUTLINE_SECONDARY"}>
          {type}
        </SeverityBadge>
      );
    },
    filterFn: "arrIncludesSome",
    meta: {
      sort: true,
      filter: true,
    },
  },
  {
    id: "status",
    accessorKey: "status",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Status" />
    ),
    cell: ({ row }) => {
      const status = row.getValue("status") as ScanStatus;
      const config = SCAN_STATUS_CONFIG[status];
      const Icon = config.icon;
      return (
        <div className="flex items-center">
          {status === "RUNNING" ? (
            <div className="h-1 w-16 rounded-full bg-muted overflow-hidden flex-1">
              <div
                className="h-full bg-primary animate-pulse transition-all duration-500"
                style={{ width: `${Math.max(5, row.original.progress || 0)}%` }}
              />
            </div>
          ) : (
            <SeverityBadge theme={config.theme} className="gap-1.5">
              <Icon className="size-3" />
              <span className="text-xs">{config.label}</span>
            </SeverityBadge>
          )}
        </div>
      );
    },
    meta: {
      sort: true,
      filter: true,
    },
  },
  {
    accessorKey: "findingsSummary",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Findings" />
    ),
    cell: ({ row }) => {
      const summary = row.original.findingsSummary ?? {
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
        total: 0,
      };
      const theme = (
        summary.critical > 0
          ? "CRITICAL"
          : summary.high > 0
            ? "HIGH"
            : summary.medium > 0
              ? "MEDIUM"
              : summary.low > 0
                ? "LOW"
                : "NONE"
      ) as Severity;

      return <SeverityBadge theme={theme}>{summary.total}</SeverityBadge>;
    },
    meta: { sort: true },
    sortingFn: (rowA, rowB) =>
      (rowA.original.findingsSummary?.total ?? 0) -
      (rowB.original.findingsSummary?.total ?? 0),
  },
  {
    id: "startedAt",
    accessorKey: "startedAt",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Started" />
    ),
    cell: ({ row }) => (
      <div className="text-[11px] font-medium text-muted-foreground opacity-80">
        {formatRelativeTime(row.getValue("startedAt"))}
      </div>
    ),
    meta: { sort: true },
    sortingFn: "datetime",
  },
  {
    id: "duration",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Duration" />
    ),
    accessorFn: (row) => {
      if (!row.startedAt || !row.completedAt) return 0;
      return (
        new Date(row.completedAt).getTime() - new Date(row.startedAt).getTime()
      );
    },
    cell: ({ row }) => {
      const { startedAt, completedAt, status } = row.original;
      if (status === "RUNNING")
        return (
          <SeverityBadge theme="LOW">
            <Loader2 className="size-3 animate-spin" />
          </SeverityBadge>
        );
      return (
        <span className="text-[11px] font-medium text-muted-foreground">
          {startedAt && completedAt
            ? formatDuration(startedAt, completedAt)
            : "--"}
        </span>
      );
    },
    meta: { sort: true },
  },
  {
    id: "actions",
    header: "Actions",
    cell: ({ row }) => <ScanRowActions scan={row.original} />,
  },
];



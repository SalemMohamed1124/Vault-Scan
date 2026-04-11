"use client";

import type { ScanSchedule } from "@/types";
import { DataTableColumnHeader } from "@/components/dataTable/DataTableColumnHeader";
import type { ColumnDef } from "@tanstack/react-table";
import { SeverityBadge } from "@/components/layout/SeverityBadge";
import { Calendar } from "lucide-react";
import ScheduleRowActions from "./ScheduleRowActions";
import { formatDateTime } from "@/lib/utils";
import ScheduleMobileCard from "./ScheduleMobileCard";

export const ScheduleColumns: ColumnDef<ScanSchedule>[] = [
  {
    id: "card",
    meta: { hideOnDesktop: true, className: "p-0" },
    cell: ({ row }) => <ScheduleMobileCard schedule={row.original} />,
  },
  {
    accessorKey: "asset",
    header: "Asset",
    meta: {
      search: { placeholder: "Search by asset", searchPath: "name" },
    },
    cell: ({ row }) => {
      const asset = row.original.asset;
      return (
        <div className="truncate font-medium">
          {asset?.name || "Unnamed Asset"}
        </div>
      );
    },
  },
  {
    accessorKey: "scanType",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Scan Type" />
    ),
    filterFn: "arrIncludesSome",
    meta: { filter: true, sort: true },
    cell: ({ row }) => {
      const type = row.original.scanType;
      return (
        <SeverityBadge variant="outline" className="uppercase">
          {type}
        </SeverityBadge>
      );
    },
  },
  {
    accessorKey: "frequency",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Frequency" />
    ),
    filterFn: "arrIncludesSome",
    meta: { filter: true, sort: true },
    cell: ({ row }) => {
      const frequency = row.original.frequency;
      return (
        <SeverityBadge variant="outline" className="capitalize">
          {frequency?.toLowerCase() || "Not scheduled"}
        </SeverityBadge>
      );
    },
  },
  {
    id: "status",
    accessorFn: (row) => (row.isActive ? "active" : "paused"),
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Status" />
    ),
    filterFn: "arrIncludesSome",
    meta: {
      filter: true,
      sort: true,
    },
    cell: ({ row }) => {
      const isActive = row.original.isActive;
      return (
        <SeverityBadge theme={isActive ? "none" : "medium"}>
          {isActive ? "Active" : "Paused"}
        </SeverityBadge>
      );
    },
  },
  {
    accessorKey: "nextRunAt",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Next Scan" />
    ),
    meta: { sort: true },
    cell: ({ row }) => {
      const nexRunTime = row.original.nextRunAt;
      return (
        <SeverityBadge
          variant="outline"
          className="flex gap-2 p-0 w-fit items-center border-none bg-transparent"
        >
          <Calendar className="size-4" />
          <span className="text-sm">
            {nexRunTime ? formatDateTime(nexRunTime) : "Not scheduled"}
          </span>
        </SeverityBadge>
      );
    },
  },
  {
    id: "actions",
    header: "Actions",
    meta: { className: "w-20" },
    cell: ({ row }) => <ScheduleRowActions schedule={row.original} />,
  },
];



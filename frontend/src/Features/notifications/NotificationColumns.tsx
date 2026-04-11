"use client";

import type { ColumnDef } from "@tanstack/react-table";
import type { Notification } from "@/types";
import { DataTableColumnHeader } from "@/components/dataTable/DataTableColumnHeader";
import { SeverityBadge } from "@/components/layout/SeverityBadge";
import {
  CheckCircle,
  XCircle,
  Sparkles,
  AlertTriangle,
  Bell,
} from "lucide-react";
import { formatRelativeTime } from "@/lib/utils";
import NotificationCard from "./NotificationCard";
import { cn } from "@/lib/utils";

const ICON_MAP: Record<string, any> = {
  SCAN_COMPLETE: CheckCircle,
  SCAN_FAILED: XCircle,
  AI_ANALYSIS_READY: Sparkles,
  CRITICAL_VULN: AlertTriangle,
};

export const NotificationColumns: ColumnDef<Notification, any>[] = [
  {
    id: "card",
    cell: ({ row }) => <NotificationCard notification={row.original} />,
    meta: {
      className: "p-0",
      hideOnDesktop: true,
    },
  },
  {
    accessorKey: "type",
    filterFn: "arrIncludesSome",

    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Type" />
    ),
    cell: ({ row }) => {
      const type = row.original.type;
      const Icon = ICON_MAP[type] ?? Bell;
      const containerStyles = cn(
        "size-8 flex items-center justify-center border border-border/10 shadow-sm",
        type === "CRITICAL_VULN"
          ? "bg-red-500/10 text-red-500"
          : "bg-muted/30 text-muted-foreground",
      );

      return (
        <div className="flex items-center gap-2.5">
          <div className={containerStyles}>
            <Icon className="size-4" />
          </div>
          <span className="text-[11px] font-bold uppercase tracking-tight truncate max-w-[150px]">
            {type.replace(/_/g, " ")}
          </span>
        </div>
      );
    },
    meta: {
      filter: true,
      search: { placeholder: "Search type..." },
    },
  },
  {
    accessorKey: "message",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Message" />
    ),
    cell: ({ row }) => {
      const messageStyles = cn(
        "text-xs max-w-[400px] whitespace-normal break-words leading-tight font-medium",
        row.original.isRead
          ? "text-muted-foreground opacity-60"
          : "text-foreground",
      );
      return <p className={messageStyles}>{row.original.message}</p>;
    },
    meta: { search: { placeholder: "Search messages..." } },
  },
  {
    accessorKey: "createdAt",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Date" />
    ),
    cell: ({ row }) => (
      <span className="text-[11px] font-bold text-muted-foreground opacity-60 uppercase tracking-widest">
        {formatRelativeTime(row.original.createdAt)}
      </span>
    ),
    meta: { sort: true },
  },
  {
    id: "status",
    accessorFn: (row) => (row.isRead ? "Read" : "Unread"),
    filterFn: "arrIncludesSome",
    header: "Status",
    cell: ({ row }) => (
      <SeverityBadge
        theme={row.original.isRead ? "none" : "informative"}
        className="text-[10px] font-bold px-2 py-0.5 uppercase"
      >
        {row.original.isRead ? "Read" : "Unread"}
      </SeverityBadge>
    ),
    meta: { filter: true },
  },
];



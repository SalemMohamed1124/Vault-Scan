import { DataTableColumnHeader } from "@/components/DataTable/DataTableColumnHeader";
import { facetedFilter } from "@/lib/utils";
import type { ColumnDef } from "@tanstack/react-table";
import type { Invitation } from "@/Types/data-types";
import InvitationMobileCard from "./InvitationMobileCard";
import { Badge } from "@/components/Customized/badge";
import { Calendar } from "lucide-react";
import { format, parseISO } from "date-fns";
import InvitationRowActions from "./InvitationRowActions";

export const InvitationsColumns: ColumnDef<Invitation>[] = [
  {
    id: "card",
    meta: {
      hideOnDesktop: true,
      className: "p-0",
    },
    cell: ({ row }) => <InvitationMobileCard invitation={row.original} />,
  },
  {
    accessorKey: "email",
    header: "Email",
    meta: {
      search: { placeholder: "Search by email" },
    },
    cell: ({ row }) => <div className="font-medium">{row.original.email}</div>,
  },
  {
    accessorKey: "role",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Role" />,
    filterFn: facetedFilter,
    meta: {
      filter: true,
    },
    cell: ({ row }) => {
      const roleTheme = row.original.role === "admin" ? "informative" : row.original.role === "editor" ? "low" : "none";
      return (
        <Badge theme={roleTheme} className="capitalize">
          {row.original.role}
        </Badge>
      );
    },
  },
  {
    accessorKey: "status",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
    filterFn: facetedFilter,
    meta: {
      filter: true,
    },
    cell: ({ row }) => {
      const statusColors: Record<string, "informative" | "low" | "medium" | "none"> = {
        pending: "medium",
        accepted: "informative",
        expired: "low",
        revoked: "none",
      };
      return (
        <Badge theme={statusColors[row.original.status] || "none"} className="capitalize">
          {row.original.status}
        </Badge>
      );
    },
  },
  {
    accessorKey: "sentBy",
    header: "Sent By",
    cell: ({ row }) => row.original.sentBy,
  },
  {
    accessorKey: "sentDate",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Sent Date" />,
    meta: { sort: true },
    cell: ({ row }) => (
      <Badge variant="outline" className="flex gap-2 p-0 w-fit items-center border-none bg-transparent">
        <Calendar className="size-4" />
        <span className="text-sm">{format(parseISO(row.original.sentDate), "PPP")}</span>
      </Badge>
    ),
  },
  {
    id: "actions",
    header: "Actions",
    meta: { className: "w-20" },
    cell: ({ row }) => <InvitationRowActions invitation={row.original} />,
  },
];

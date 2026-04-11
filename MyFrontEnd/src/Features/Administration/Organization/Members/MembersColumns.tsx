import type { Member } from "@/Types/data-types";
import { DataTableColumnHeader } from "@/components/DataTable/DataTableColumnHeader";
import { facetedFilter } from "@/lib/utils";
import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/Customized/badge";
import MemberRowActions from "./MemberRowActions";
import MemberMobileCard from "./MemberMobileCard";
import { Calendar } from "lucide-react";
import { format, parseISO } from "date-fns";

export const MembersColumns: ColumnDef<Member>[] = [
  {
    id: "card",
    meta: { hideOnDesktop: true, className: "p-0" },
    cell: ({ row }) => <MemberMobileCard member={row.original} />,
  },
  {
    accessorKey: "name",
    header: "Name",
    meta: { search: { placeholder: "Search by name" } },
    cell: ({ row }) => {
      const name = row.getValue("name") as string;
      return <div className="font-medium truncate">{name}</div>;
    },
  },
  {
    accessorKey: "email",
    header: "Email",
    cell: ({ row }) => row.getValue("email"),
  },
  {
    accessorKey: "role",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Role" />,
    filterFn: facetedFilter,
    meta: { filter: true, sort: true },
    cell: ({ row }) => {
      const role = row.getValue("role") as string;
      const roleTheme = role === "admin" ? "informative" : role === "editor" ? "low" : "none";
      return (
        <Badge theme={roleTheme} className="capitalize">
          {role}
        </Badge>
      );
    },
  },
  {
    accessorKey: "joinedDate",
    sortingFn: "datetime",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Joined Date" />,
    meta: { sort: true },
    cell: ({ row }) => {
      const joinedDate = row.getValue("joinedDate") as string;
      return (
        <Badge variant="outline" className="flex gap-2 p-0 w-fit items-center border-none bg-transparent ">
          <Calendar className="size-4" />
          <span className="text-sm">{format(parseISO(joinedDate), "PPP")}</span>
        </Badge>
      );
    },
  },
  {
    id: "actions",
    header: "Actions",
    meta: { className: "w-20" },
    cell: ({ row }) => <MemberRowActions member={row.original} />,
  },
];

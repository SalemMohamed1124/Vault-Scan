"use client";

import type { ColumnDef } from "@tanstack/react-table";
import type { OrgMember, OrgRole } from "@/types";
import { DataTableColumnHeader } from "@/components/dataTable/DataTableColumnHeader";
import { SeverityBadge } from "@/components/layout/SeverityBadge";
import { Crown, Eye, Pencil } from "lucide-react";
import MemberRowActions from "./MemberRowActions";
import MemberCard from "./MemberCard";

const ROLE_THEMES: Record<OrgRole, any> = {
  ADMIN: { theme: "critical", icon: Crown },
  EDITOR: { theme: "informative", icon: Pencil },
  VIEWER: { theme: "none", icon: Eye },
};

export const MemberColumns: ColumnDef<OrgMember>[] = [
  {
    id: "card",
    cell: ({ row }) => <MemberCard member={row.original} />,
    meta: { hideOnDesktop: true, className: "p-0" },
  },
  {
    id: "user",
    accessorKey: "user",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="User" />
    ),
    cell: ({ row }) => {
      const member = row.original;
      return (
        <div className="flex items-center gap-3">
          <div className="size-10 flex items-center justify-center font-bold text-sm bg-muted text-muted-foreground">
            {member.user.name?.[0]?.toUpperCase() ?? "?"}
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold">{member.user.name}</span>
            <span className="text-xs text-muted-foreground">
              {member.user.email}
            </span>
          </div>
        </div>
      );
    },
    meta: {
      sort: true,
      search: { placeholder: "Search members..." },
    },
  },
  {
    id: "role",
    accessorKey: "role",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Role" />
    ),
    cell: ({ row }) => {
      const role = row.getValue("role") as OrgRole;
      const roleInfo = ROLE_THEMES[role];
      const RoleIcon = roleInfo.icon;
      return (
        <SeverityBadge
          theme={roleInfo.theme}
          className="text-[10px] py-0 px-2 h-5 gap-1.5 border shadow-sm"
        >
          <RoleIcon className="size-3" />
          {role}
        </SeverityBadge>
      );
    },
    meta: {
      filter: true,
    },
  },
  {
    id: "actions",
    header: "Actions",
    cell: ({ row }) => <MemberRowActions member={row.original} />,
  },
];



"use client";

import { useAuth } from "@/hooks/useAuth";
import { SeverityBadge } from "@/components/layout/SeverityBadge";
import { Crown, Eye, Pencil, User } from "lucide-react";
import type { OrgMember, OrgRole } from "@/types";
import MemberRowActions from "./MemberRowActions";
import { cn } from "@/lib/utils";

const ROLE_THEMES: Record<OrgRole, any> = {
  ADMIN: {
    theme: "critical",
    icon: Crown,
    color: "text-red-500",
    bg: "bg-red-500/10",
  },
  EDITOR: {
    theme: "informative",
    icon: Pencil,
    color: "text-blue-500",
    bg: "bg-blue-500/10",
  },
  VIEWER: {
    theme: "none",
    icon: Eye,
    color: "text-muted-foreground",
    bg: "bg-muted/20",
  },
};

export default function MemberCard({ member }: { member: OrgMember }) {
  const { user: currentUser } = useAuth();
  const isSelf = member.user.id === currentUser?.id;
  const roleInfo = ROLE_THEMES[member.role as OrgRole];
  const RoleIcon = roleInfo.icon;

  const cardStyles = cn(
    "flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 border",
    isSelf ? "bg-muted/30 border-primary/20" : "bg-card border-border/50",
  );

  return (
    <div className={cardStyles}>
      <div className="flex items-center gap-4 min-w-0 flex-1">
        <div
          className={cn(
            "size-12 flex items-center justify-center font-bold text-lg shrink-0",
            roleInfo.bg,
          )}
        >
          {member.user.name?.[0]?.toUpperCase() ?? (
            <User className="size-6 text-muted-foreground" />
          )}
        </div>

        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-sm font-bold text-foreground truncate">
              {member.user.name}
            </span>
            {isSelf && (
              <SeverityBadge
                theme="none"
                className="bg-primary/10 text-primary text-[10px] py-0 px-2 h-4 uppercase font-black tracking-widest leading-normal"
              >
                YOU
              </SeverityBadge>
            )}
          </div>
          <span className="text-xs text-muted-foreground/70 truncate tracking-tight">
            {member.user.email}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3 shrink-0 w-full sm:w-auto justify-between sm:justify-end border-t sm:border-none pt-3 sm:pt-0 mt-1 sm:mt-0">
        <SeverityBadge
          theme={roleInfo.theme}
          className="text-[10px] py-0 px-2.5 h-6 gap-2 border border-current/10 font-bold"
        >
          <RoleIcon className="size-3" />
          {member.role}
        </SeverityBadge>
        {!isSelf && <MemberRowActions member={member} />}
      </div>
    </div>
  );
}

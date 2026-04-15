"use client";

import { useOrg } from "@/hooks/useOrg";
import { useUpdateMemberRole, useRemoveMember } from "../useSettingMutations";
import { Button } from "@/components/ui/button";
import { 
  Trash2, Settings2, ShieldCheck, ShieldAlert, Shield, 
  ChevronDown 
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { OrgMember, OrgRole } from "@/types";
import { useAuth } from "@/hooks/useAuth";
import { useConfirm } from "@/Contexts/ConfirmModalContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { useSidebar } from "@/components/ui/sidebar";

interface MemberRowActionsProps {
  member: OrgMember;
}

const ROLE_ICONS: Record<OrgRole, any> = {
  ADMIN: ShieldAlert,
  EDITOR: ShieldCheck,
  VIEWER: Shield,
};

export default function MemberRowActions({ member }: MemberRowActionsProps) {
  const { activeOrgId } = useOrg();
  const { user: currentUser } = useAuth();
  const { mutateAsync: updateRoleApi } = useUpdateMemberRole();
  const { mutateAsync: removeMemberApi } = useRemoveMember();
  const { confirm } = useConfirm();
  const { isMobile } = useSidebar();
  const isSelf = member.user.id === currentUser?.id;

  if (isSelf) return null;

  function handleUpdateRole(role: OrgRole) {
    confirm({
      title: "Update Member Role",
      description: `Are you sure you want to change ${member.user.name}'s role to ${role}?`,
      confirmText: "Change Role",
      onConfirm: async () => {
        await updateRoleApi({ orgId: activeOrgId!, memberId: member.id, role });
      },
    });
  }

  function handleRemoveMember() {
    confirm({
      title: "Remove Member",
      description: `Are you sure you want to remove ${member.user.name} from this organization? This action cannot be undone.`,
      variant: "danger",
      confirmText: "Remove Member",
      onConfirm: async () => {
        await removeMemberApi({ orgId: activeOrgId!, memberId: member.id });
      },
    });
  }

  if (isMobile) {
    return (
      <div className="grid grid-cols-2 gap-2 w-full">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="w-full text-xs gap-2 h-9">
              <Settings2 className="size-3.5" />
              Manage
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel className="text-[10px] uppercase text-muted-foreground tracking-widest px-2 py-1.5">
              Assign Role
            </DropdownMenuLabel>
            {(["ADMIN", "EDITOR", "VIEWER"] as OrgRole[]).map((role) => {
              const Icon = ROLE_ICONS[role];
              const isCurrent = member.role === role;
              return (
                <DropdownMenuItem
                  key={role}
                  onClick={() => handleUpdateRole(role)}
                  className={cn(
                    "flex items-center gap-2 text-xs font-semibold py-2 px-3",
                    isCurrent && "bg-primary/5 text-primary"
                  )}
                >
                  <Icon className={cn("size-3.5", isCurrent ? "text-primary" : "text-muted-foreground")} />
                  {role}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
        <Button 
          variant="destructive" 
          onClick={handleRemoveMember} 
          className="w-full text-xs gap-2 h-9"
        >
          <Trash2 className="size-3.5" />
          Remove
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 shrink-0">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-8 gap-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground"
          >
            Manage
            <ChevronDown className="size-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel className="text-[10px] uppercase text-muted-foreground tracking-widest px-2 py-1.5">
            Assign Role
          </DropdownMenuLabel>
          {(["ADMIN", "EDITOR", "VIEWER"] as OrgRole[]).map((role) => {
            const Icon = ROLE_ICONS[role];
            const isCurrent = member.role === role;
            return (
              <DropdownMenuItem
                key={role}
                onClick={() => handleUpdateRole(role)}
                className={cn(
                  "flex items-center gap-2 text-xs font-semibold py-2 px-3",
                  isCurrent && "bg-primary/5 text-primary"
                )}
              >
                <Icon className={cn("size-3.5", isCurrent ? "text-primary" : "text-muted-foreground")} />
                {role}
                {isCurrent && <span className="ml-auto text-[8px] font-black uppercase text-primary/50">Current</span>}
              </DropdownMenuItem>
            );
          })}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={handleRemoveMember}
            className="flex items-center gap-2 text-xs font-semibold py-2 px-3 text-destructive focus:text-destructive focus:bg-destructive/10"
          >
            <Trash2 className="size-3.5" />
            Remove from Org
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

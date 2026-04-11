import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Copy, MoreHorizontal, Pencil, Trash } from "lucide-react";
import type { Member } from "@/Types/data-types";
import { useSidebar } from "@/components/ui/sidebar";
import { useConfirm } from "@/Contexts/ConfirmModalContext";
import useMember from "./useMember";
import useMemberFormModals from "./useMemberFormModals";
import { toClipboard } from "@/lib/utils";

type MemberRowActionsProps = {
  member: Member;
};

export default function MemberRowActions({ member }: MemberRowActionsProps) {
  const { isMobile } = useSidebar();
  const { confirm } = useConfirm();
  const { deleteMemberApi } = useMember();
  const { openEditMember } = useMemberFormModals();

  function handleEdit() {
    openEditMember(member);
  }

  const handleDelete = () => {
    confirm({
      title: "Remove Member",
      description: `Are you sure you want to remove ${member.name}? This action cannot be undone.`,
      variant: "danger",
      confirmText: "Remove",
      onConfirm: async () => {
        await deleteMemberApi(member.id);
      },
    });
  };

  if (isMobile)
    return (
      <div className="flex gap-2 w-full flex-wrap *:flex-1 mt-4">
        <Button variant={"outline"} onClick={() => toClipboard(member.email, "Email Address copied to clipboard")}>
          <Copy />
          Email
        </Button>
        <Button variant={"outline"} onClick={handleEdit}>
          <Pencil />
          Edit Role
        </Button>
        <Button variant={"destructive"} onClick={handleDelete}>
          <Trash />
          Remove
        </Button>
      </div>
    );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost">
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Actions</DropdownMenuLabel>
        <DropdownMenuItem onClick={() => toClipboard(member.email, "Email Address copied to clipboard")}>
          <Copy />
          Copy Email
        </DropdownMenuItem>

        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleEdit}>
          <Pencil />
          Edit Role
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleDelete} className="text-destructive focus:text-destructive">
          <Trash />
          Remove Member
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

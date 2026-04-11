import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, RotateCcw, Trash, Mail } from "lucide-react";
import type { Invitation } from "@/Types/data-types";
import { useSidebar } from "@/components/ui/sidebar";
import { toClipboard } from "@/lib/utils";

import useInvitation from "./useInvitation";
import { Spinner } from "@/components/ui/spinner";
import { useConfirm } from "@/Contexts/ConfirmModalContext";

type InvitationRowActionsProps = {
  invitation: Invitation;
};

export default function InvitationRowActions({ invitation }: InvitationRowActionsProps) {
  const { isMobile } = useSidebar();
  const { confirm } = useConfirm();
  const { resendInvitationApi, revokeInvitationApi, deleteInvitationApi, isResending, isRevoking, isDeleting } = useInvitation();

  function handleResend() {
    resendInvitationApi(invitation.id);
  }

  function handleRevoke() {
    confirm({
      title: "Revoke Invitation",
      description: `Are you sure you want to revoke invitation for ${invitation.email}?`,
      variant: "danger",
      onConfirm: async () => {
        await revokeInvitationApi(invitation.id);
      },
    });
  }

  function handleDelete() {
    confirm({
      title: "Delete Invitation",
      description: `Are you sure you want to delete invitation for ${invitation.email}?`,
      variant: "danger",
      onConfirm: async () => {
        if (invitation.status !== "revoked") await revokeInvitationApi(invitation.id);
        await deleteInvitationApi(invitation.id);
      },
    });
  }

  if (isMobile) {
    return (
      <div className="flex gap-2 w-full flex-wrap *:flex-1 mt-4">
        <Button variant={"outline"} onClick={() => toClipboard(invitation.email, "Email Address copied to clipboard")}>
          <Mail />
          Email
        </Button>
        <Button variant={"outline"} onClick={handleResend} disabled={invitation.status === "accepted" || isResending}>
          <RotateCcw />
          {isResending ? <Spinner /> : "Resend"}
        </Button>
        <Button
          variant={"destructive"}
          onClick={handleRevoke}
          disabled={invitation.status === "accepted" || invitation.status === "revoked" || isRevoking}
        >
          <Trash />
          {isRevoking ? <Spinner /> : "Revoke"}
        </Button>
        <Button variant={"destructive"} onClick={handleDelete} disabled={isDeleting}>
          <Trash />
          {isDeleting ? <Spinner /> : "Delete"}
        </Button>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost">
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Actions</DropdownMenuLabel>
        <DropdownMenuItem onClick={() => toClipboard(invitation.email, "Email Address copied to clipboard")}>
          <Mail />
          Copy Email
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={handleResend} disabled={invitation.status === "accepted" || isResending}>
          <RotateCcw />
          {isResending ? <Spinner /> : "Resend"}
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={handleRevoke}
          className="text-destructive focus:text-destructive"
          disabled={invitation.status === "accepted" || invitation.status === "revoked" || isRevoking}
        >
          <Trash />
          {isRevoking ? <Spinner /> : "Revoke"}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleDelete} className="text-destructive focus:text-destructive" disabled={isDeleting}>
          <Trash />
          {isDeleting ? <Spinner /> : "Delete"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

import { DataTable } from "@/components/DataTable/DataTable";
import useInvitations from "./useInvitations";
import { InvitationsColumns } from "./InvitationsColumns";
import useMemberFormModals from "../Members/useMemberFormModals";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export default function InvitationsTable() {
  const { invitations, isPending, error } = useInvitations();
  const { openInviteMember } = useMemberFormModals();

  return (
    <DataTable
      columns={InvitationsColumns}
      data={invitations || []}
      toolbar={{
        search: true,
        export: false,
        viewOptions: false,
        filter: true,
      }}
      extraActions={
        <Button onClick={openInviteMember} variant="primary">
          <Plus />
          Invite Member
        </Button>
      }
      isLoading={isPending}
      error={error as any}
      tableName="Invitations"
    />
  );
}

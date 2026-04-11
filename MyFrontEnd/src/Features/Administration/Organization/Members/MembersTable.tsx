import { DataTable } from "@/components/DataTable/DataTable";
import { MembersColumns } from "./MembersColumns";
import useMembers from "./useMembers";
import useMemberFormModals from "./useMemberFormModals";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

function MembersTable() {
  const { isPending, members = [], error } = useMembers();
  const { openInviteMember } = useMemberFormModals();

  return (
    <DataTable
      columns={MembersColumns}
      data={members}
      isLoading={isPending}
      tableName="MembersTable"
      error={error}
      extraActions={
        <Button onClick={openInviteMember} variant="primary">
          <Plus />
          Invite Member
        </Button>
      }
    />
  );
}

export default MembersTable;

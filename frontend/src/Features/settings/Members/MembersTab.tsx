"use client";

import { useOrg } from "@/hooks/useOrg";
import { useOrgMembers } from "../useSettings";
import { DataTable } from "@/components/dataTable/DataTable";
import { MemberColumns } from "./MemberColumns";
import InviteMemberModal from "./InviteMemberModal";

export default function MembersTab() {
  const { activeOrgId } = useOrg();
  const { items: members = [], isPending, isError, error } = useOrgMembers(activeOrgId);

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex flex-col">
        <h2 className="text-lg font-semibold text-foreground">
          Personnel Registry
        </h2>
        <p className="text-xs text-muted-foreground">
          Manage organization access and roles
        </p>
      </div>

      <DataTable
        tableName="MembersTable"
        columns={MemberColumns}
        data={members}
        isPending={isPending}
        error={isError ? error : undefined}
        cardsLayout={true}
        disablePagination={members.length < 10}
        toolbar={{
          search: true,
          export: false,
          filter: true,
          viewOptions: false,
        }}
        extraActions={<InviteMemberModal />}
      />
    </div>
  );
}

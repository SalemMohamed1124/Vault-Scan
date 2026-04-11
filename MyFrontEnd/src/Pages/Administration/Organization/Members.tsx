import MembersTable from "@/Features/Administration/Organization/Members/MembersTable";
import MembersSummary from "@/Features/Administration/Organization/Members/MembersSummary";

function Organization() {
  return (
    <div className="w-full space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-medium">Team Members</h2>
          <p className="text-sm text-muted-foreground">Manage who has access to your organization.</p>
        </div>
      </div>

      <div className="w-full">
        <MembersSummary />
      </div>

      <div className="w-full">
        <MembersTable />
      </div>
    </div>
  );
}

export default Organization;

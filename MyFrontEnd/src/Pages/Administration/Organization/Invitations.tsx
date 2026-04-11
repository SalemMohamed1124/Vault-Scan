import InvitationsSummary from "@/Features/Administration/Organization/Invitations/InvitationsSummary";
import InvitationsTable from "@/Features/Administration/Organization/Invitations/InvitationsTable";

function Invitations() {
  return (
    <div className="w-full space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-medium">Team Members</h2>
          <p className="text-sm text-muted-foreground">Manage who has access to your organization.</p>
        </div>
      </div>

      <div className="w-full">
        <InvitationsSummary />
      </div>

      <div className="w-full">
        <InvitationsTable />
      </div>
    </div>
  );
}

export default Invitations;

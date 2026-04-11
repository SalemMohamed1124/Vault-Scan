import { Summary } from "@/components/Customized/summary";
import useInvitations from "./useInvitations";
import { Clock, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";

export default function InvitationsSummary() {
  const { invitations } = useInvitations();

  if (!invitations) return null;

  return (
    <Summary data={invitations}>
      <Summary.Card
        label="Pending"
        sublabel="Awaiting recipient action"
        icon={<Clock className="size-4" />}
        find={{ column: "status", value: "pending" }}
        variant="medium"
      />
      <Summary.Card
        label="Accepted"
        sublabel="Invitations that were accepted"
        icon={<CheckCircle2 className="size-4" />}
        find={{ column: "status", value: "accepted" }}
        variant="informative"
      />
      <Summary.Card
        label="Expired"
        sublabel="No longer valid invitations"
        icon={<AlertTriangle className="size-4" />}
        find={{ column: "status", value: "expired" }}
        variant="low"
      />
      <Summary.Card
        label="Revoked"
        sublabel="Manually cancelled invitations"
        icon={<XCircle className="size-4" />}
        find={{ column: "status", value: "revoked" }}
        variant="none"
      />
    </Summary>
  );
}

import { MobileCard } from "@/components/Customized/mobile-card";
import type { Invitation } from "@/Types/data-types";
import { Badge } from "@/components/Customized/badge";
import InvitationRowActions from "./InvitationRowActions";
import { Calendar } from "lucide-react";
import { format, parseISO } from "date-fns";

function InvitationMobileCard({ invitation }: { invitation: Invitation }) {
  const statusColors: Record<string, "informative" | "low" | "medium" | "none"> = {
    pending: "medium",
    accepted: "informative",
    expired: "low",
    revoked: "none",
  };

  return (
    <MobileCard>
      <MobileCard.Header>
        <span className="font-medium text-lg truncate max-w-55">{invitation.email}</span>
        <Badge theme={statusColors[invitation.status] || "none"} className="w-fit capitalize">
          {invitation.status}
        </Badge>
      </MobileCard.Header>

      <MobileCard.Content>
        <MobileCard.Row>
          <span className="text-muted-foreground font-medium">Role:</span>
          <span className="capitalize">{invitation.role}</span>
        </MobileCard.Row>

        <MobileCard.Row>
          <span className="text-muted-foreground font-medium">Sent By:</span>
          <span>{invitation.sentBy}</span>
        </MobileCard.Row>

        <MobileCard.Row>
          <span className="text-muted-foreground font-medium">Sent Date:</span>
          <Badge theme="none" className="flex gap-2 p-0 w-fit items-center border-none bg-transparent">
            <Calendar className="size-4" />
            <span className="text-xs text-muted-foreground">{format(parseISO(invitation.sentDate), "PPP")}</span>
          </Badge>
        </MobileCard.Row>

        {invitation.expiresAccepted && (
          <MobileCard.Row>
            <span className="text-muted-foreground font-medium">
              {invitation.status === "accepted" ? "Accepted:" : "Expires:"}
            </span>
            <span className="text-sm">{format(parseISO(invitation.expiresAccepted), "PPP")}</span>
          </MobileCard.Row>
        )}
      </MobileCard.Content>

      <MobileCard.Footer>
        <InvitationRowActions invitation={invitation} />
      </MobileCard.Footer>
    </MobileCard>
  );
}

export default InvitationMobileCard;

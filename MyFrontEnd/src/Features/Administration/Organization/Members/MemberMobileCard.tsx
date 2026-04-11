import { MobileCard } from "@/components/Customized/mobile-card";
import type { Member } from "@/Types/data-types";
import { Badge } from "@/components/Customized/badge";
import MemberRowActions from "./MemberRowActions";
import { Calendar } from "lucide-react";
import { format, parseISO } from "date-fns";

function MemberMobileCard({ member }: { member: Member }) {
  const role = member.role;
  const roleTheme = role === "admin" ? "informative" : role === "editor" ? "low" : "outlineSecondary";
  return (
    <MobileCard>
      <MobileCard.Header>
        <span className="font-medium text-lg">{member.name}</span>
        <span className="text-sm text-muted-foreground">{member.email}</span>
      </MobileCard.Header>

      <MobileCard.Content>
        <MobileCard.Row>
          <span className="text-muted-foreground font-medium">Role:</span>
          <Badge theme={roleTheme} className="capitalize">
            {role}
          </Badge>
        </MobileCard.Row>

        <MobileCard.Row>
          <span className="text-muted-foreground font-medium">Joined:</span>
          <Badge theme="none" className="flex gap-2 p-0 w-fit items-center border-none bg-transparent">
            <Calendar className="size-4" />
            <span className="text-xs text-muted-foreground">{format(parseISO(member.joinedDate), "PPP")}</span>
          </Badge>
        </MobileCard.Row>
      </MobileCard.Content>

      <MobileCard.Footer>
        <MemberRowActions member={member} />
      </MobileCard.Footer>
    </MobileCard>
  );
}

export default MemberMobileCard;

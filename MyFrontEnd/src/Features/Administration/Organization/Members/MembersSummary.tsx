import { Summary } from "@/components/Customized/summary";
import useMembers from "./useMembers";
import { Shield, Settings, Eye } from "lucide-react";

export default function MembersSummary() {
  const { members } = useMembers();

  if (!members) return null;

  return (
    <Summary data={members}>
      <Summary.Card
        label="Admins"
        sublabel="Full access to organization settings"
        icon={<Shield className="size-4" />}
        find={{ column: "role", value: "admin" }}
        variant="informative"
      />
      <Summary.Card
        label="Editors"
        sublabel="Full access to scans and assets management"
        icon={<Settings className="size-4" />}
        find={{ column: "role", value: "editor" }}
        variant="low"
      />
      <Summary.Card
        label="Viewers"
        sublabel="Read-only access to results"
        icon={<Eye className="size-4" />}
        find={{ column: "role", value: "viewer" }}
        variant="none"
      />
    </Summary>
  );
}

import { useViewModal } from "@/Contexts/ViewModalContext";
import { MemberForm } from "./MemberForm";
import type { Member } from "@/Types/data-types";

export default function useMemberFormModals() {
  const { view } = useViewModal();

  const openInviteMember = () => {
    view({
      title: "Invite Member",
      content: <MemberForm />,
      defaultScroll: false,
    });
  };

  const openEditMember = (member: Member) => {
    view({
      title: "Edit Member",
      content: <MemberForm member={member} />,
      defaultScroll: false,
    });
  };

  return { openInviteMember, openEditMember };
}

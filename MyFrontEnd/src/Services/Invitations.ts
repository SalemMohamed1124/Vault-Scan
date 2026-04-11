import { fakeInvitations } from "../../public/Invitations";
import { InvitationsSchema } from "../Types/data-types";

export async function fetchInvitations() {
  await new Promise((resolve) => setTimeout(resolve, 300));
  return InvitationsSchema.parse(fakeInvitations);
}

export async function deleteInvitation(id: string) {
  await new Promise((resolve) => setTimeout(resolve, 500));
  const index = fakeInvitations.findIndex((i) => i.id === id);
  if (index !== -1) {
    fakeInvitations.splice(index, 1);
    return true;
  }
  throw new Error("Invitation not found");
}

export async function resendInvitation(id: string) {
  await new Promise((resolve) => setTimeout(resolve, 800));
  const invitation = fakeInvitations.find((i) => i.id === id);
  if (invitation) {
    invitation.sentDate = new Date().toISOString();
    return invitation;
  }
  throw new Error("Invitation not found");
}

export async function revokeInvitation(id: string) {
  await new Promise((resolve) => setTimeout(resolve, 500));
  const index = fakeInvitations.findIndex((i) => i.id === id);
  if (index !== -1) {
    fakeInvitations[index].status = "revoked";
    return fakeInvitations[index];
  }
  throw new Error("Invitation not found");
}

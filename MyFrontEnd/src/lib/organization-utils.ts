import type { Member } from "@/Types/data-types";

export function isEmailAlreadyMember(email: string, members: Member[]) {
  return members.find((member) => member.email === email);
}

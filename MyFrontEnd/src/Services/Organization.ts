import type { Member } from "../Types/data-types";
import { fakeMembers } from "../../public/Members";
import { MemberSchema, MembersSchema } from "../Types/data-types";

export async function fetchMembers() {
  await new Promise((resolve) => setTimeout(resolve, 200));
  return MembersSchema.parse(fakeMembers);
}

export async function fetchMember(id: string) {
  await new Promise((resolve) => setTimeout(resolve, 200));
  const member = fakeMembers.find((m) => m.id === id);
  return MemberSchema.parse(member);
}

export async function deleteMember(id: string) {
  await new Promise((r) => setTimeout(r, 200));
  const index = fakeMembers.findIndex((m) => m.id === id);
  if (index !== -1) fakeMembers.splice(index, 1);
}

export async function addMember(newMember: Omit<Member, "id" | "joinedDate">) {
  await new Promise((r) => setTimeout(r, 1000));
  const member: Member = {
    ...newMember,
    id: Math.random().toString(36).substring(2, 9),
    joinedDate: new Date().toISOString(),
  };
  fakeMembers.push(member);
  return member;
}

export async function updateMember(id: string, updatedMember: Omit<Member, "id" | "joinedDate">) {
  await new Promise((r) => setTimeout(r, 800));
  const index = fakeMembers.findIndex((m) => m.id === id);
  if (index !== -1) {
    fakeMembers[index] = { ...fakeMembers[index], ...updatedMember };
    return fakeMembers[index];
  }
  throw new Error("Member not found");
}

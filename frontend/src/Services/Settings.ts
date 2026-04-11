import api from "@/lib/api";
import type { OrgMember, OrgRole, ChangePasswordPayload } from "@/types";

export async function fetchOrgMembers(orgId: string) {
  const { data } = await api.get(`/api/organizations/${orgId}/members`);
  return data as OrgMember[];
}

export async function updateProfile(name: string) {
  const { data } = await api.patch("/api/auth/profile", { name });
  return data as { id: string; name: string; email: string };
}

export async function changePassword(payload: ChangePasswordPayload) {
  await api.post("/api/auth/change-password", payload);
}

export async function updateOrganization(orgId: string, name: string) {
  await api.patch(`/api/organizations/${orgId}`, { name });
}

export async function deleteOrganization(orgId: string) {
  await api.delete(`/api/organizations/${orgId}`);
}

export async function updateMemberRole(orgId: string, memberId: string, role: OrgRole) {
  await api.patch(`/api/organizations/${orgId}/members/${memberId}`, { role });
}

export async function removeMember(orgId: string, memberId: string) {
  await api.delete(`/api/organizations/${orgId}/members/${memberId}`);
}

export async function inviteMember(orgId: string, payload: { email: string; role: OrgRole }) {
  await api.post(`/api/organizations/${orgId}/members`, payload);
}

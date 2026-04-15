"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { setStoredUser, getStoredOrgs, setStoredOrgs } from "@/Services/auth";
import { notifyAuthChange } from "@/hooks/useAuth";
import type { OrgRole, User } from "@/types";
import {
  updateProfile as updateProfileApiReq,
  changePassword as changePasswordApiReq,
  updateOrganization as updateOrgApiReq,
  deleteOrganization as deleteOrgApiReq,
  updateMemberRole as updateRoleApiReq,
  removeMember as removeMemberApiReq,
  inviteMember as inviteMemberApiReq,
} from "@/Services/Settings";

export function useUpdateProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ name }: { name: string; user: User }) =>
      updateProfileApiReq(name),
    onSuccess: (data, { user }) => {
      toast.success("Profile updated successfully");
      setStoredUser({ ...data, createdAt: user?.createdAt ?? "" });
      notifyAuthChange();
      queryClient.invalidateQueries({ queryKey: ["auth"] });
    },
    onError: () => toast.error("Failed to update profile"),
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: changePasswordApiReq,
    onSuccess: () => toast.success("Password changed successfully"),
    onError: () => toast.error("Failed to update password"),
  });
}

export function useUpdateOrganization() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ orgId, name }: { orgId: string; name: string }) =>
      updateOrgApiReq(orgId, name),
    onSuccess: (_, { orgId, name }) => {
      toast.success("Organization updated");

      const orgs = getStoredOrgs();
      const updatedOrgs = orgs.map((o) =>
        o.id === orgId ? { ...o, name } : o,
      );
      setStoredOrgs(updatedOrgs);

      queryClient.invalidateQueries({ queryKey: ["auth"] });
      notifyAuthChange();
    },
    onError: () => toast.error("Failed to update organization"),
  });
}

export function useDeleteOrganization() {
  return useMutation({
    mutationFn: deleteOrgApiReq,
    onSuccess: (_, orgId) => {
      toast.success("Organization deleted");

      const orgs = getStoredOrgs();
      setStoredOrgs(orgs.filter((o) => o.id !== orgId));

      window.location.href = "/overview";
    },
    onError: () => toast.error("Failed to delete organization"),
  });
}

export function useUpdateMemberRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      orgId,
      memberId,
      role,
    }: {
      orgId: string;
      memberId: string;
      role: OrgRole;
    }) => updateRoleApiReq(orgId, memberId, role),
    onSuccess: (_, { orgId }) => {
      toast.success("Member role updated");
      queryClient.invalidateQueries({ queryKey: ["org-members", orgId] });
    },
    onError: () => toast.error("Failed to update role"),
  });
}

export function useRemoveMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ orgId, memberId }: { orgId: string; memberId: string }) =>
      removeMemberApiReq(orgId, memberId),
    onSuccess: (_, { orgId }) => {
      toast.success("Member removed");
      queryClient.invalidateQueries({ queryKey: ["org-members", orgId] });
    },
    onError: () => toast.error("Failed to remove member"),
  });
}

export function useInviteMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      orgId,
      payload,
    }: {
      orgId: string;
      payload: { email: string; role: OrgRole };
    }) => inviteMemberApiReq(orgId, payload),
    onSuccess: (_, { orgId }) => {
      toast.success("Invitation sent successfully");
      queryClient.invalidateQueries({ queryKey: ["org-members", orgId] });
    },
    onError: () => toast.error("Failed to invite member"),
  });
}

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

export default function useSetting() {
  const queryClient = useQueryClient();

  const {
    isPending: isUpdatingProfile,
    mutateAsync: updateProfileApi,
    error: updateProfileError,
  } = useMutation({
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

  const {
    isPending: isChangingPassword,
    mutateAsync: changePasswordApi,
    error: changePasswordError,
  } = useMutation({
    mutationFn: changePasswordApiReq,
    onSuccess: () => toast.success("Password changed successfully"),
    onError: () => toast.error("Failed to update password"),
  });

  const {
    isPending: isUpdatingOrg,
    mutateAsync: updateOrgApi,
    error: updateOrgError,
  } = useMutation({
    mutationFn: ({ orgId, name }: { orgId: string; name: string }) =>
      updateOrgApiReq(orgId, name),
    onSuccess: (_, { orgId, name }) => {
      toast.success("Organization updated");

      // Update local storage to ensure UI syncs across components
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

  const {
    isPending: isDeletingOrg,
    mutateAsync: deleteOrgApi,
    error: deleteOrgError,
  } = useMutation({
    mutationFn: deleteOrgApiReq,
    onSuccess: (_, orgId) => {
      toast.success("Organization deleted");

      // Update local storage
      const orgs = getStoredOrgs();
      setStoredOrgs(orgs.filter((o) => o.id !== orgId));

      window.location.href = "/overview";
    },
    onError: () => toast.error("Failed to delete organization"),
  });

  const {
    isPending: isUpdatingRole,
    mutateAsync: updateRoleApi,
    error: updateRoleError,
  } = useMutation({
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

  const {
    isPending: isRemovingMember,
    mutateAsync: removeMemberApi,
    error: removeMemberError,
  } = useMutation({
    mutationFn: ({ orgId, memberId }: { orgId: string; memberId: string }) =>
      removeMemberApiReq(orgId, memberId),
    onSuccess: (_, { orgId }) => {
      toast.success("Member removed");
      queryClient.invalidateQueries({ queryKey: ["org-members", orgId] });
    },
    onError: () => toast.error("Failed to remove member"),
  });

  const {
    isPending: isInvitingMember,
    mutateAsync: inviteMemberApi,
    error: inviteMemberError,
  } = useMutation({
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

  return {
    isUpdatingProfile,
    updateProfileApi,
    updateProfileError,
    isChangingPassword,
    changePasswordApi,
    changePasswordError,
    isUpdatingOrg,
    updateOrgApi,
    updateOrgError,
    isDeletingOrg,
    deleteOrgApi,
    deleteOrgError,
    isUpdatingRole,
    updateRoleApi,
    updateRoleError,
    isRemovingMember,
    removeMemberApi,
    removeMemberError,
    isInvitingMember,
    inviteMemberApi,
    inviteMemberError,
  };
}

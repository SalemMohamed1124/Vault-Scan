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

  const mutation = useMutation({
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

  return {
    mutate: mutation.mutate,
    mutateAsync: mutation.mutateAsync,
    isPending: mutation.isPending,
    isError: mutation.isError,
    error: mutation.error,
  };
}

export function useChangePassword() {
  const mutation = useMutation({
    mutationFn: changePasswordApiReq,
    onSuccess: () => toast.success("Password changed successfully"),
    onError: () => toast.error("Failed to update password"),
  });

  return {
    mutate: mutation.mutate,
    mutateAsync: mutation.mutateAsync,
    isPending: mutation.isPending,
    isError: mutation.isError,
    error: mutation.error,
  };
}

export function useUpdateOrganization() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
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

  return {
    mutate: mutation.mutate,
    mutateAsync: mutation.mutateAsync,
    isPending: mutation.isPending,
    isError: mutation.isError,
    error: mutation.error,
  };
}

export function useDeleteOrganization() {
  const mutation = useMutation({
    mutationFn: deleteOrgApiReq,
    onSuccess: (_, orgId) => {
      toast.success("Organization deleted");

      const orgs = getStoredOrgs();
      setStoredOrgs(orgs.filter((o) => o.id !== orgId));

      window.location.href = "/overview";
    },
    onError: () => toast.error("Failed to delete organization"),
  });

  return {
    mutate: mutation.mutate,
    mutateAsync: mutation.mutateAsync,
    isPending: mutation.isPending,
    isError: mutation.isError,
    error: mutation.error,
  };
}

export function useUpdateMemberRole() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
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

  return {
    mutate: mutation.mutate,
    mutateAsync: mutation.mutateAsync,
    isPending: mutation.isPending,
    isError: mutation.isError,
    error: mutation.error,
  };
}

export function useRemoveMember() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: ({ orgId, memberId }: { orgId: string; memberId: string }) =>
      removeMemberApiReq(orgId, memberId),
    onSuccess: (_, { orgId }) => {
      toast.success("Member removed");
      queryClient.invalidateQueries({ queryKey: ["org-members", orgId] });
    },
    onError: () => toast.error("Failed to remove member"),
  });

  return {
    mutate: mutation.mutate,
    mutateAsync: mutation.mutateAsync,
    isPending: mutation.isPending,
    isError: mutation.isError,
    error: mutation.error,
  };
}

export function useInviteMember() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
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
    mutate: mutation.mutate,
    mutateAsync: mutation.mutateAsync,
    isPending: mutation.isPending,
    isError: mutation.isError,
    error: mutation.error,
  };
}

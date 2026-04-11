"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth, notifyAuthChange } from "./useAuth";
import { setActiveOrgId } from "@/Services/auth";
import type { Organization, OrgRole } from "@/types";

interface UseOrgReturn {
  organizations: Organization[];
  activeOrg: Organization | undefined;
  activeOrgId: string | undefined;
  activeRole: OrgRole | undefined;
  switchOrg: (orgId: string) => void;
  isAdmin: boolean;
  isEditorOrAbove: boolean;
}

export function useOrg(): UseOrgReturn {
  const { organizations, activeOrgId } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();

  const activeOrg = (organizations ?? []).find((o) => o.id === activeOrgId);
  const activeRole = activeOrg?.role;

  const switchOrg = useCallback(
    (orgId: string) => {
      setActiveOrgId(orgId);
      notifyAuthChange();
      // Invalidate all cached data when switching orgs
      queryClient.invalidateQueries();
      router.push("/overview");
    },
    [queryClient, router],
  );

  return {
    organizations,
    activeOrg,
    activeOrgId,
    activeRole,
    switchOrg,
    isAdmin: activeRole === "ADMIN",
    isEditorOrAbove: activeRole === "ADMIN" || activeRole === "EDITOR",
  };
}

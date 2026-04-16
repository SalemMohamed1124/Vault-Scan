"use client";

import { useQuery } from "@tanstack/react-query";
import type { OrgMember } from "@/types";
import { fetchOrgMembers } from "@/Services/Settings";

export function useOrgMembers(orgId: string | undefined) {
  const query = useQuery<OrgMember[]>({
    queryKey: ["org-members", orgId],
    queryFn: () => fetchOrgMembers(orgId!),
    enabled: !!orgId,
  });

  const items = query.data ?? [];
  const isEmpty = !query.isPending && !query.isError && items.length === 0;

  return {
    items,
    isPending: query.isPending,
    isError: query.isError,
    error: query.error,
    isEmpty,
    refetch: query.refetch,
  };
}

"use client";

import { useQuery } from "@tanstack/react-query";
import type { OrgMember } from "@/types";
import { fetchOrgMembers } from "@/Services/Settings";

export function useOrgMembers(orgId: string | undefined) {
  return useQuery<OrgMember[]>({
    queryKey: ["org-members", orgId],
    queryFn: () => fetchOrgMembers(orgId!),
    enabled: !!orgId,
  });
}

import { useQuery } from "@tanstack/react-query";
import { fetchMembers } from "@/Services/Organization";
import type { Member } from "@/Types/data-types";

export default function useMembers() {
  const {
    isPending,
    data: members,
    error,
  } = useQuery<Member[], Error>({
    queryKey: ["Members"],
    queryFn: fetchMembers,
  });

  return {
    isPending,
    members,
    error,
  };
}

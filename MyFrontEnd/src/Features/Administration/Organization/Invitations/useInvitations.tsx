import { fetchInvitations } from "@/Services/Invitations";
import { type Invitation } from "@/Types/data-types";
import { useQuery } from "@tanstack/react-query";

export default function useInvitations() {
  const {
    isPending,
    data: invitations,
    error,
  } = useQuery<Invitation[], Error>({
    queryKey: ["Invitations"],
    queryFn: fetchInvitations,
  });

  return { isPending, invitations, error };
}

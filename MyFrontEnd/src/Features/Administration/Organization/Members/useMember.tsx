import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchMember, deleteMember, addMember, updateMember } from "@/Services/Organization";
import { toast } from "sonner";
import type { Member } from "@/Types/data-types";

export default function useMember(id?: string) {
  const queryClient = useQueryClient();

  const {
    isPending,
    data: member,
    error,
  } = useQuery<Member, Error>({
    queryKey: ["Member", id],
    queryFn: () => fetchMember(id!),
    enabled: !!id,
  });

  const { isPending: isDeleting, mutateAsync: deleteMemberApi } = useMutation({
    mutationFn: (id: string) => deleteMember(id),
    onSuccess: () => {
      toast.success("Member removed successfully");
      queryClient.invalidateQueries({ queryKey: ["Members"] });
    },
    onError: () => {
      toast.error("Failed to remove member");
    },
  });

  const { isPending: isAdding, mutateAsync: addMemberApi } = useMutation({
    mutationFn: (newMember: Omit<Member, "id" | "joinedDate">) => addMember(newMember),
    onSuccess: () => {
      toast.success("Member invited successfully");
      queryClient.invalidateQueries({ queryKey: ["Members"] });
    },
    onError: () => {
      toast.error("Failed to invite member");
    },
  });

  const { isPending: isUpdating, mutateAsync: updateMemberApi } = useMutation({
    mutationFn: ({ id, updatedMember }: { id: string; updatedMember: Omit<Member, "id" | "joinedDate"> }) =>
      updateMember(id, updatedMember),
    onSuccess: () => {
      toast.success("Member updated successfully");
      queryClient.invalidateQueries({ queryKey: ["Members"] });
    },
    onError: () => {
      toast.error("Failed to update member");
    },
  });

  return {
    isPending,
    member,
    error,
    isDeleting,
    deleteMemberApi,
    isAdding,
    addMemberApi,
    isUpdating,
    updateMemberApi,
  };
}

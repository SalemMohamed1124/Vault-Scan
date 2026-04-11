import { useMutation, useQueryClient } from "@tanstack/react-query";
import { deleteInvitation, resendInvitation, revokeInvitation } from "@/Services/Invitations";
import { toast } from "sonner";

export default function useInvitation() {
  const queryClient = useQueryClient();

  const { isPending: isDeleting, mutateAsync: deleteInvitationApi } = useMutation({
    mutationFn: (id: string) => deleteInvitation(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["Invitations"] });
      toast.success("Invitation deleted successfully");
    },
    onError: () => {
      toast.error("Failed to delete invitation");
    },
  });

  const { isPending: isResending, mutateAsync: resendInvitationApi } = useMutation({
    mutationFn: (id: string) => resendInvitation(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["Invitations"] });
      toast.success("Invitation resent successfully");
    },
    onError: () => {
      toast.error("Failed to resend invitation");
    },
  });

  const { isPending: isRevoking, mutateAsync: revokeInvitationApi } = useMutation({
    mutationFn: (id: string) => revokeInvitation(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["Invitations"] });
      toast.success("Invitation revoked successfully");
    },
    onError: () => {
      toast.error("Failed to revoke invitation");
    },
  });

  return {
    isDeleting,
    deleteInvitationApi,
    isResending,
    resendInvitationApi,
    isRevoking,
    revokeInvitationApi,
  };
}

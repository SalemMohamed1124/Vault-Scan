import { useMutation, useQueryClient } from "@tanstack/react-query";
import { markAllAsRead, markAsRead } from "@/Services/Notifications";

export function useNotification() {
  const queryClient = useQueryClient();
  const {
    mutateAsync: markAsReadApi,
    isPending: isMarkAsReadPending,
    error: markAsReadError,
  } = useMutation({
    mutationFn: (id: string) => markAsRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const {
    mutateAsync: markAllAsReadApi,
    isPending: isMarkAllAsReadPending,
    error: markAllAsReadError,
  } = useMutation({
    mutationFn: () => markAllAsRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
  return { markAsReadApi, isMarkAsReadPending, markAsReadError, markAllAsReadApi, isMarkAllAsReadPending, markAllAsReadError };
}

"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { markAsRead, markAllAsRead } from "@/Services/Notifications";
import { toast } from "sonner";

export function useNotification() {
  const queryClient = useQueryClient();

  const { 
    mutate: markReadApi, 
    isPending: isMarkReadPending 
  } = useMutation({
    mutationFn: markAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications-list"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] }); 
    },
    onError: () => toast.error("Failed to mark as read"),
  });

  const { 
    mutate: markAllReadApi, 
    isPending: isMarkAllReadPending 
  } = useMutation({
    mutationFn: markAllAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications-list"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      toast.success("All notifications marked as read");
    },
    onError: () => toast.error("Failed to mark all as read"),
  });

  return {
    markReadApi,
    isMarkReadPending,
    markAllReadApi,
    isMarkAllReadPending,
  };
}

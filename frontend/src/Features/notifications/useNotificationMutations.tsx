"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { markAsRead, markAllAsRead } from "@/Services/Notifications";
import { toast } from "sonner";

export function useMarkAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: markAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications-list"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] }); 
    },
    onError: () => toast.error("Failed to mark notification as read"),
  });
}

export function useMarkAllAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: markAllAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications-list"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      toast.success("All notifications marked as read");
    },
    onError: () => toast.error("Failed to mark all as read"),
  });
}

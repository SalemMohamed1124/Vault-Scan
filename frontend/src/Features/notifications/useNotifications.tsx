"use client";

import { useQuery } from "@tanstack/react-query";
import type { Notification } from "@/types";
import { fetchNotifications } from "@/Services/Notifications";

export function useNotifications() {
  const query = useQuery<Notification[], Error>({
    queryKey: ["notifications-list"],
    queryFn: fetchNotifications,
  });

  const items = query.data ?? [];
  const unreadCount = items.filter((n) => !n.isRead).length;
  const isEmpty = !query.isPending && !query.isError && items.length === 0;

  return {
    items,
    unreadCount,
    isPending: query.isPending,
    isError: query.isError,
    error: query.error,
    isEmpty,
    refetch: query.refetch,
  };
}

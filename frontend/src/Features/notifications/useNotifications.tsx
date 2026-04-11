"use client";

import { useQuery } from "@tanstack/react-query";
import type { Notification } from "@/types";
import { fetchNotifications } from "@/Services/Notifications";

export function useNotifications() {
  const {
    data: notifications = [],
    isPending,
    error,
  } = useQuery<Notification[], Error>({
    queryKey: ["notifications-list"],
    queryFn: fetchNotifications,
  });
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return { notifications, isPending, error, unreadCount };
}

import api from "@/lib/api";
import type { Notification } from "@/types";

export async function fetchNotifications() {
  const { data } = await api.get<Notification[]>("/api/notifications", {
    params: { limit: 50 },
  });
  return Array.isArray(data) ? data : [];
}

export async function markAsRead(id: string) {
  await api.patch(`/api/notifications/${id}/read`);
}

export async function markAllAsRead() {
  await api.patch("/api/notifications/read-all");
}

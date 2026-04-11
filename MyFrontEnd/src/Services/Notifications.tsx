import { NotificationsSchema } from "@/Types/data-types";
import { fakeNotifications } from "@/../public/Notifications";

export async function fetchNotifications() {
  await new Promise((resolve) => setTimeout(resolve, 500));
  return NotificationsSchema.parse(fakeNotifications);
}

export async function markAsRead(id: string) {
  await new Promise((resolve) => setTimeout(resolve, 500));
  const notification = fakeNotifications.find((n) => n.id === id);
  if (notification) notification.read = true;
}

export async function markAllAsRead() {
  await new Promise((resolve) => setTimeout(resolve, 500));
  fakeNotifications.forEach((notification) => (notification.read = true));
}

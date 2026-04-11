import { useQuery } from "@tanstack/react-query";
import type { Notification } from "@/Types/data-types";
import { fetchNotifications } from "@/Services/Notifications";

export default function useNotifications() {
  const {
    data: notifications,
    isPending,
    error,
  } = useQuery<Notification[], Error>({
    queryKey: ["notifications"],
    queryFn: fetchNotifications,
  });
  return { notifications, isPending, error };
}

import { deleteSchedule, updateSchedule } from "@/Services/Schedules";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

import { useQueryClient } from "@tanstack/react-query";
import type { Schedule } from "@/Types/data-types";

export default function useSchedule() {
  const queryClient = useQueryClient();
  const {
    isPending: isDeleting,
    mutateAsync: deleteScheduleApi,
    error: deleteError,
  } = useMutation({
    mutationFn: (id: string) => deleteSchedule(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["Schedules"] });
      toast.success(`Schedule #${id} deleted successfully`);
    },
    onError: (_, id) => {
      toast.error(`Failed to delete schedule ${id}`);
    },
  });

  const {
    isPending: isUpdating,
    mutateAsync: updateScheduleApi,
    error: updateError,
  } = useMutation({
    mutationFn: ({ id, updatedSchedule }: { id: string; updatedSchedule: Omit<Schedule, "id"> }) =>
      updateSchedule(id, updatedSchedule),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["Schedules"] });
      toast.success(`Schedule #${id} updated successfully`, {
        position: "top-center",
      });
    },
    onError: (_, { id }) => {
      toast.error(`Failed to update schedule #${id}`, {
        position: "top-center",
      });
    },
  });

  return { isDeleting, deleteScheduleApi, deleteError, isUpdating, updateScheduleApi, updateError };
}

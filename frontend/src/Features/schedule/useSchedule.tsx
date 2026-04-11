"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { 
  fetchSchedule, 
  deleteSchedule, 
  createSchedule, 
  updateSchedule 
} from "@/Services/Schedules";
import type { ScanSchedule } from "@/types";

export default function useSchedule(id?: string) {
  const queryClient = useQueryClient();

  const {
    isPending,
    data: schedule,
    error,
  } = useQuery({
    queryFn: () => fetchSchedule(id!),
    queryKey: ["schedule", id],
    enabled: !!id,
  });

  const {
    isPending: isDeleting,
    mutateAsync: deleteScheduleApi,
    error: deleteError,
  } = useMutation({
    mutationFn: deleteSchedule,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedules"] });
      toast.success("Schedule deleted successfully");
    },
    onError: () => {
      toast.error("Failed to delete schedule");
    },
  });

  const {
    isPending: isAdding,
    mutateAsync: addScheduleApi,
    error: addingError,
  } = useMutation({
    mutationFn: createSchedule,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedules"] });
      toast.success("Schedule created successfully");
    },
    onError: () => {
      toast.error("Failed to create schedule");
    },
  });

  const {
    isPending: isUpdating,
    mutateAsync: updateScheduleApi,
    error: updateError,
  } = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ScanSchedule> }) => 
      updateSchedule(id, data),
    onSuccess: () => {
      toast.success("Schedule updated successfully");
      queryClient.invalidateQueries({ queryKey: ["schedules"] });
      if (id) queryClient.invalidateQueries({ queryKey: ["schedule", id] });
    },
    onError: () => {
      toast.error("Failed to update schedule");
    },
  });

  return {
    isPending,
    error,
    schedule,
    isDeleting,
    deleteScheduleApi,
    deleteError,
    isAdding,
    addScheduleApi,
    addingError,
    isUpdating,
    updateScheduleApi,
    updateError,
  };
}

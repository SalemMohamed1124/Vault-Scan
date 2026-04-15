"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  deleteSchedule, 
  createSchedule, 
  updateSchedule 
} from "@/Services/Schedules";
import type { ScanSchedule } from "@/types";

export function useCreateSchedule() {
  const queryClient = useQueryClient();
  const pathname = usePathname();

  return useMutation({
    mutationFn: createSchedule,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedules"] });
      const isSchedulesPage = pathname === "/schedules";
      toast.success("Schedule created successfully", {
        action: !isSchedulesPage ? (
          <Link href="/schedules" className="text-primary font-bold hover:underline text-xs mr-2 transition-all">
            View schedules
          </Link>
        ) : undefined
      });
    },
    onError: () => {
      toast.error("Failed to create schedule");
    },
  });
}

export function useUpdateSchedule(id?: string) {
  const queryClient = useQueryClient();

  return useMutation({
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
}

export function useDeleteSchedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteSchedule,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedules"] });
      toast.success("Schedule deleted successfully");
    },
    onError: () => {
      toast.error("Failed to delete schedule");
    },
  });
}

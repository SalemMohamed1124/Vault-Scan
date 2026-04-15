"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchSchedules, fetchAssetsForSchedules, fetchSchedule } from "@/Services/Schedules";

export function useSchedules() {
  const {
    isPending,
    data: schedules,
    error,
  } = useQuery({
    queryKey: ["schedules"],
    queryFn: fetchSchedules,
  });

  return { isPending, schedules, error };
}

export function useAssetsForSchedules() {
  const {
    isPending,
    data: assets,
    error,
  } = useQuery({
    queryKey: ["assets", "all-for-schedule"],
    queryFn: fetchAssetsForSchedules,
  });

  return { isPending, assets, error };
}

export function useSchedule(id: string) {
  return useQuery({
    queryKey: ["schedule", id],
    queryFn: () => fetchSchedule(id),
    enabled: !!id,
  });
}

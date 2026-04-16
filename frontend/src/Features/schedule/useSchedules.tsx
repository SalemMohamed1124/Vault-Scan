"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchSchedules, fetchAssetsForSchedules, fetchSchedule } from "@/Services/Schedules";

export function useSchedules() {
  const query = useQuery({
    queryKey: ["schedules"],
    queryFn: fetchSchedules,
  });

  const items = query.data?.data ?? [];
  const total = query.data?.total ?? 0;
  const isEmpty = !query.isPending && !query.isError && items.length === 0;

  return {
    items,
    total,
    isPending: query.isPending,
    isError: query.isError,
    error: query.error,
    isEmpty,
    refetch: query.refetch,
  };
}

export function useAssetsForSchedules() {
  const query = useQuery({
    queryKey: ["assets", "all-for-schedule"],
    queryFn: fetchAssetsForSchedules,
  });

  const items = query.data ?? [];
  const isEmpty = !query.isPending && !query.isError && items.length === 0;

  return {
    items,
    isPending: query.isPending,
    isError: query.isError,
    error: query.error,
    isEmpty,
    refetch: query.refetch,
  };
}

export function useSchedule(id: string) {
  const query = useQuery({
    queryKey: ["schedule", id],
    queryFn: () => fetchSchedule(id),
    enabled: !!id,
  });

  return {
    item: query.data ?? null,
    isPending: query.isPending,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

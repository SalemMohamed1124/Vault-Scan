"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Scan } from "@/types";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { fetchScan, startScan, deleteScan } from "@/Services/Scans";
import type { AxiosError } from "axios";

export default function useScan(id?: string) {
  const queryClient = useQueryClient();
  const router = useRouter();

  // Fetch single scan
  const {
    data: scan,
    isPending,
    error,
  } = useQuery<Scan | null>({
    queryKey: ["scan", id],
    queryFn: () => fetchScan(id!),
    enabled: !!id,
    refetchInterval: (query) => {
      const s = query.state.data;
      if (s && (s.status === "RUNNING" || s.status === "PENDING")) return 5000;
      return false;
    },
  });

  // Start scan mutation
  const {
    mutateAsync: startScanApi,
    isPending: isStarting,
    error: startError,
  } = useMutation({
    mutationFn: startScan,
    onSuccess: (data) => {
      toast.success("Scan started successfully");
      queryClient.invalidateQueries({ queryKey: ["scans"] });
      router.push(`/scans/${data.id}`);
    },
    onError: (error: AxiosError<{ message: string }>) => {
      toast.error(error.response?.data?.message || "Failed to start scan");
    },
  });

  // Delete scan mutation
  const {
    mutateAsync: deleteScanApi,
    isPending: isDeleting,
    error: deleteError,
  } = useMutation({
    mutationFn: deleteScan,
    onSuccess: () => {
      toast.success("Scan deleted successfully");
      queryClient.invalidateQueries({ queryKey: ["scans"] });
    },
    onError: (error: AxiosError<{ message: string }>) => {
      toast.error(error.response?.data?.message || "Failed to delete scan");
    },
  });

  return {
    scan,
    isPending,
    error,
    startScanApi,
    isStarting,
    startError,
    deleteScanApi,
    isDeleting,
    deleteError,
  };
}

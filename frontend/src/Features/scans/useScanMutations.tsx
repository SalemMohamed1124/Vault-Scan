"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { startScan, deleteScan, cancelScan } from "@/Services/Scans";

export function useCreateScan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: startScan,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scans"] });
      toast.success("Scan started successfully");
    },
    onError: () => {
      toast.error("Failed to start scan");
    },
  });
}

export function useDeleteScan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteScan,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scans"] });
      toast.success("Scan deleted successfully");
    },
    onError: () => {
      toast.error("Failed to delete scan");
    },
  });
}

export function useCancelScan(scanId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => cancelScan(scanId),
    onSuccess: () => {
      toast.success("Scan cancelled");
      queryClient.invalidateQueries({ queryKey: ["scan", scanId] });
      queryClient.invalidateQueries({ queryKey: ["scans"] });
    },
    onError: () => {
      toast.error("Failed to cancel scan");
    },
  });
}

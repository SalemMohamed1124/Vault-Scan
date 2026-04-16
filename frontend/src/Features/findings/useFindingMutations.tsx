"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { deleteFinding, deleteFindings } from "@/Services/Findings";

export function useDeleteFinding() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: deleteFinding,
    onSuccess: () => {
      toast.success("Finding deleted successfully");
      queryClient.invalidateQueries({ queryKey: ["findings"] });
    },
    onError: () => toast.error("Failed to delete finding"),
  });

  return {
    mutate: mutation.mutate,
    mutateAsync: mutation.mutateAsync,
    isPending: mutation.isPending,
    isError: mutation.isError,
    error: mutation.error,
  };
}

export function useDeleteManyFindings() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: deleteFindings,
    onSuccess: () => {
      toast.success("Batch deletion completed");
      queryClient.invalidateQueries({ queryKey: ["findings"] });
    },
    onError: () => toast.error("Failed to delete findings"),
  });

  return {
    mutate: mutation.mutate,
    mutateAsync: mutation.mutateAsync,
    isPending: mutation.isPending,
    isError: mutation.isError,
    error: mutation.error,
  };
}

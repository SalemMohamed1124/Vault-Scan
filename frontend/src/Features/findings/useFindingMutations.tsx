"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { deleteFinding, deleteFindings } from "@/Services/Findings";

export function useDeleteFinding() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteFinding,
    onSuccess: () => {
      toast.success("Finding deleted successfully");
      queryClient.invalidateQueries({ queryKey: ["findings"] });
    },
    onError: () => toast.error("Failed to delete finding"),
  });
}

export function useDeleteManyFindings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteFindings,
    onSuccess: () => {
      toast.success("Batch deletion completed");
      queryClient.invalidateQueries({ queryKey: ["findings"] });
    },
    onError: () => toast.error("Failed to delete findings"),
  });
}

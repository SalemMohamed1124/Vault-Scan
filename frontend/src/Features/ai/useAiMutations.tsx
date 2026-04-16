"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { 
  retryAIAnalysis, 
  fetchAIRemediation, 
  sendAIChatMessage 
} from "@/Services/AI";
import type { ChatMessage } from "@/types";
import { RemediationGuide } from "./useAI";

export function useRetryAiAnalysis(scanId: string) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => retryAIAnalysis(scanId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-analysis", scanId] });
      toast.success("Retrying AI analysis...");
    },
    onError: () => {
      toast.error("Failed to retry AI analysis");
    }
  });

  return {
    mutate: mutation.mutate,
    mutateAsync: mutation.mutateAsync,
    isPending: mutation.isPending,
    isError: mutation.isError,
    error: mutation.error,
  };
}

export function useAiChat() {
  const mutation = useMutation({
    mutationFn: ({ message, history, scanId }: { message: string, history: ChatMessage[], scanId?: string }) => 
      sendAIChatMessage(message, history, scanId)
  });

  return {
    mutate: mutation.mutate,
    mutateAsync: mutation.mutateAsync,
    isPending: mutation.isPending,
    isError: mutation.isError,
    error: mutation.error,
  };
}

export function useAiRemediation(findingId: string) {
  const mutation = useMutation<RemediationGuide, Error, void>({
    mutationFn: () => fetchAIRemediation(findingId),
    onError: () => toast.error("Failed to generate remediation guide"),
  });

  return {
    mutate: mutation.mutate,
    mutateAsync: mutation.mutateAsync,
    isPending: mutation.isPending,
    isError: mutation.isError,
    error: mutation.error,
  };
}

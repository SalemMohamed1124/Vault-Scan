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

  return useMutation({
    mutationFn: () => retryAIAnalysis(scanId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-analysis", scanId] });
      toast.success("Retrying AI analysis...");
    },
    onError: () => {
      toast.error("Failed to retry AI analysis");
    }
  });
}

export function useAiChat() {
  return useMutation({
    mutationFn: ({ message, history, scanId }: { message: string, history: ChatMessage[], scanId?: string }) => 
      sendAIChatMessage(message, history, scanId)
  });
}

export function useAiRemediation(findingId: string) {
  return useMutation<RemediationGuide, Error, void>({
    mutationFn: () => fetchAIRemediation(findingId),
    onError: () => toast.error("Failed to generate remediation guide"),
  });
}

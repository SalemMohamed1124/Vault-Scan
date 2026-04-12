"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { 
  fetchAIAnalysis, 
  retryAIAnalysis, 
  fetchAIRemediation, 
  sendAIChatMessage, 
  fetchAIInsights 
} from "@/Services/AI";
import type { AiAnalysis, ChatMessage } from "@/types";

export interface RemediationStep {
  step: number;
  title: string;
  description: string;
  code?: string;
  language?: string;
}

export interface RemediationGuide {
  title: string;
  severity: string;
  whatIsIt: string;
  whyItMatters: string;
  steps: RemediationStep[];
  verification: string;
  references: string[];
}

export interface Priority {
  title: string;
  description: string;
  severity: "critical" | "high" | "medium" | "low";
  actionable: string;
}

export interface InsightsData {
  summary: string;
  priorities: Priority[];
  positiveFeedback: string;
  riskTrend: string;
}

export function useAiAnalysis(scanId: string) {
  const queryClient = useQueryClient();

  const query = useQuery<AiAnalysis | null>({
    queryKey: ["ai-analysis", scanId],
    queryFn: () => fetchAIAnalysis(scanId).catch(() => null),
    refetchInterval: (query) => {
      const d = query.state.data;
      if (d && d.status === "PROCESSING") return 3000;
      return false;
    },
  });

  const retryMutation = useMutation({
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
    ...query,
    retryAnalysis: retryMutation.mutate,
    isRetrying: retryMutation.isPending,
  };
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

export function useAiInsights() {
  return useQuery<InsightsData>({
    queryKey: ["ai-insights"],
    queryFn: fetchAIInsights,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}

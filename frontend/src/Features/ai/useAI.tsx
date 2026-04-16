"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchAIAnalysis, fetchAIInsights } from "@/Services/AI";
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
  const query = useQuery<AiAnalysis | null>({
    queryKey: ["ai-analysis", scanId],
    queryFn: () => fetchAIAnalysis(scanId).catch(() => null),
    refetchInterval: (queryState) => {
      const d = queryState.state.data;
      if (d && d.status === "PROCESSING") return 3000;
      return false;
    },
  });

  return {
    analysis: query.data ?? null,
    isPending: query.isPending,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

export function useAiInsights() {
  const query = useQuery<InsightsData>({
    queryKey: ["ai-insights"],
    queryFn: fetchAIInsights,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  return {
    insights: query.data ?? null,
    isPending: query.isPending,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

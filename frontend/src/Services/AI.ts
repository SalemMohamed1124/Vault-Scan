import api from "@/lib/api";
import type { AiAnalysis, ChatMessage } from "@/types";

export async function fetchAIAnalysis(scanId: string) {
  const { data } = await api.get<AiAnalysis>(`/api/scans/${scanId}/ai-analysis`);
  return data;
}

export async function retryAIAnalysis(scanId: string) {
  await api.post(`/api/scans/${scanId}/ai-analysis/retry`);
}

export async function fetchAIRemediation(findingId: string) {
  const { data } = await api.post(`/api/ai/findings/${findingId}/remediation`);
  return data;
}

export async function sendAIChatMessage(message: string, history: ChatMessage[], scanId?: string) {
  const { data } = await api.post<{ reply: string }>("/api/ai/chat", {
    message,
    history,
    scanId,
  });
  return data;
}

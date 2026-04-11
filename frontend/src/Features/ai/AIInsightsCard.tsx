"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  Loader2,
  ChevronRight,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import api from "@/lib/api";

interface Priority {
  title: string;
  description: string;
  severity: "critical" | "high" | "medium" | "low";
  actionable: string;
}

interface InsightsData {
  summary: string;
  priorities: Priority[];
  positiveFeedback: string;
  riskTrend: string;
}

const severityConfig: Record<
  string,
  { color: string; bgColor: string; icon: typeof AlertTriangle }
> = {
  critical: {
    color: "text-red-400",
    bgColor: "bg-red-500/10 border-red-500/20",
    icon: AlertTriangle,
  },
  high: {
    color: "text-orange-400",
    bgColor: "bg-orange-500/10 border-orange-500/20",
    icon: AlertTriangle,
  },
  medium: {
    color: "text-yellow-400",
    bgColor: "bg-yellow-500/10 border-yellow-500/20",
    icon: AlertTriangle,
  },
  low: {
    color: "text-blue-400",
    bgColor: "bg-blue-500/10 border-blue-500/20",
    icon: AlertTriangle,
  },
};

export function AIInsightsCard() {
  const {
    data: insights,
    isLoading,
    refetch,
    isFetching,
  } = useQuery<InsightsData>({
    queryKey: ["ai-insights"],
    queryFn: async () => {
      const { data } = await api.get<InsightsData>("/api/ai/insights");
      return data;
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  if (isLoading) {
    return (
      <div className="glass-card rounded-xl border border-border/50 bg-muted/30 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/20">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">AI Insights</h3>
            <p className="text-xs text-muted-foreground font-medium">Analyzing your security data...</p>
          </div>
        </div>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (!insights || !insights.summary) {
    return null;
  }

  return (
    <div className="glass-card rounded-xl border border-border/50 bg-muted/30 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/50 bg-muted/30 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/20 border border-primary/10">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">AI Security Insights</h3>
            <p className="text-[11px] font-medium tracking-wide uppercase text-muted-foreground/80">Powered by Gemini AI</p>
          </div>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="rounded-lg p-2 text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
          title="Refresh insights"
        >
          <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
        </button>
      </div>

      <div className="p-6 space-y-5">
        {/* Summary */}
        <p className="text-sm leading-relaxed text-foreground/80 font-medium">
          {insights.summary}
        </p>

        {/* Priorities */}
        {insights.priorities.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
              Top Priorities
            </h4>
            {insights.priorities.map((p, i) => {
              const config = severityConfig[p.severity] ?? severityConfig.medium;
              return (
                <div
                  key={i}
                  className={cn(
                    "glass-card rounded-xl border p-4 transition-all hover:bg-muted/40",
                    config.bgColor,
                  )}
                >
                  <div className="flex items-start gap-4">
                    <config.icon className={cn("h-4 w-4 mt-0.5 shrink-0", config.color)} />
                    <div className="flex-1 min-w-0">
                      <h5 className="text-sm font-bold text-foreground">{p.title}</h5>
                      <p className="mt-1.5 text-xs text-muted-foreground font-medium">{p.description}</p>
                      <div className="mt-3 flex items-center gap-1.5 text-[11px] font-bold text-primary uppercase tracking-wider">
                        <ChevronRight className="h-3 w-3" />
                        <span>{p.actionable}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Positive Feedback & Risk Trend */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          {insights.positiveFeedback && (
            <div className="glass-card rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0 text-emerald-500" />
                <div>
                  <h5 className="text-[11px] font-bold tracking-widest uppercase text-emerald-500 mb-1.5">
                    What You&apos;re Doing Right
                  </h5>
                  <p className="text-xs text-foreground/80 leading-relaxed font-medium">
                    {insights.positiveFeedback}
                  </p>
                </div>
              </div>
            </div>
          )}
          {insights.riskTrend && (
            <div className="glass-card rounded-xl border border-border/50 bg-muted/10 p-4">
              <div className="flex items-start gap-3">
                <TrendingUp className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
                <div>
                  <h5 className="text-[11px] font-bold tracking-widest uppercase text-primary mb-1.5">
                    Risk Trend
                  </h5>
                  <p className="text-xs text-foreground/80 leading-relaxed font-medium">
                    {insights.riskTrend}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

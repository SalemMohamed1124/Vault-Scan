"use client";

import { useState } from "react";

import {
  Bot,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Loader2,
  Shield,
  Tag,
  FileText,
  Scale,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { RiskGauge } from "./RiskGauge";
import { Skeleton } from "@/components/ui/skeleton";
import type { AiAnalysis } from "@/types";
import { useAiAnalysis } from "./useAI";
import { useRetryAiAnalysis } from "./useAiMutations";

interface AIAnalysisCardProps {
  scanId: string;
}

export function AIAnalysisCard({ scanId }: AIAnalysisCardProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(["summary", "recommendations"]),
  );
  const { data: analysis, isLoading } = useAiAnalysis(scanId);
  const { mutate: retryAnalysis, isPending: isRetrying } = useRetryAiAnalysis(scanId);

  function toggleSection(section: string) {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  }

  const isExpanded = (section: string) => expandedSections.has(section);

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  // No analysis yet
  if (!analysis) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
        <Bot className="h-10 w-10 opacity-40" />
        <p className="text-sm">No AI analysis available for this scan</p>
      </div>
    );
  }

  // Processing state
  if (analysis.status === "PROCESSING") {
    return (
      <div className="flex flex-col items-center gap-4 py-12">
        <div className="relative">
          <div className="h-16 w-16 animate-spin rounded-full border-4 border-border border-t-primary" />
          <Bot className="absolute left-1/2 top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 text-primary" />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-foreground">
            AI is analyzing your scan results...
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            This usually takes 15-30 seconds
          </p>
        </div>
      </div>
    );
  }

  // Failed state
  if (analysis.status === "FAILED") {
    return (
      <div className="glass-card flex flex-col items-center gap-3 rounded-xl border border-destructive/20 bg-destructive/5 p-8">
        <AlertTriangle className="h-8 w-8 text-destructive/70" />
        <p className="text-sm font-bold text-destructive">AI analysis failed</p>
        <p className="text-xs text-muted-foreground mb-4 font-medium">
          The scan results are still available in the Findings tab
        </p>
        <button
          onClick={() => retryAnalysis()}
          disabled={isRetrying}
          className="flex items-center gap-2 rounded-lg bg-primary/10 border border-primary/20 px-4 py-2 text-xs font-bold text-primary hover:bg-primary/20 transition-all disabled:opacity-50"
        >
          {isRetrying ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Bot className="h-4 w-4" />
          )}
          Retry AI Analysis
        </button>
      </div>
    );
  }

  // Completed state
  const effortColors: Record<string, string> = {
    LOW: "bg-green-500/20 text-green-400",
    MEDIUM: "bg-yellow-500/20 text-yellow-400",
    HIGH: "bg-red-500/20 text-red-400",
  };

  return (
    <div className="space-y-6">
      {/* Risk Score */}
      <div className="flex flex-col items-center glass-card rounded-xl border border-border/50 bg-muted/30 p-6 sm:flex-row sm:gap-8">
        <div className="relative shrink-0">
          <RiskGauge score={analysis.riskScore ?? 0} />
        </div>
        <div className="mt-4 flex-1 text-center sm:mt-0 sm:text-left">
          <h3 className="text-lg font-bold text-foreground">Risk Assessment</h3>
          <p className="mt-1 text-sm text-muted-foreground font-medium">
            {analysis.riskLevel} risk level based on {(analysis.keyFindings ?? []).length} key
            findings
          </p>
        </div>
      </div>

      {/* Executive Summary */}
      <CollapsibleSection
        title="Executive Summary"
        icon={FileText}
        isExpanded={isExpanded("summary")}
        onToggle={() => toggleSection("summary")}
      >
        <p className="text-sm leading-relaxed text-foreground/90">
          {analysis.analysisText}
        </p>
      </CollapsibleSection>

      {/* Key Findings */}
      {(analysis.keyFindings ?? []).length > 0 && (
        <CollapsibleSection
          title={`Key Findings (${analysis.keyFindings.length})`}
          icon={Shield}
          isExpanded={isExpanded("keyFindings")}
          onToggle={() => toggleSection("keyFindings")}
        >
          <div className="space-y-3">
            {analysis.keyFindings.map((finding, i) => (
              <div
                key={i}
                className="glass-card rounded-xl border border-border/40 bg-muted/10 p-4"
              >
                <h4 className="text-sm font-bold text-foreground leading-tight">{finding.title}</h4>
                <div className="mt-3 grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-60 block mb-1">Impact</span>
                    <span className="text-xs font-semibold text-foreground/80">{finding.impact}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-60 block mb-1">Likelihood</span>
                    <span className="text-xs font-semibold text-foreground/80">{finding.likelihood}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* Recommendations */}
      {(analysis.recommendations ?? []).length > 0 && (
        <CollapsibleSection
          title={`Recommendations (${analysis.recommendations.length})`}
          icon={AlertTriangle}
          isExpanded={isExpanded("recommendations")}
          onToggle={() => toggleSection("recommendations")}
        >
          <div className="space-y-3">
            {analysis.recommendations.map((rec, i) => (
              <div
                key={i}
                className="flex gap-4 glass-card rounded-xl border border-border/40 bg-muted/10 p-4"
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/20 text-xs font-black text-primary">
                  {rec.priority}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-foreground leading-tight">{rec.action}</p>
                  <p className="mt-1.5 text-xs text-muted-foreground font-medium">{rec.rationale}</p>
                </div>
                <span
                  className={cn(
                    "shrink-0 self-start rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider",
                    effortColors[rec.effort] ?? "bg-muted text-muted-foreground",
                  )}
                >
                  {rec.effort}
                </span>
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* Attack Vectors */}
      {(analysis.attackVectors ?? []).length > 0 && (
        <CollapsibleSection
          title="Attack Vectors"
          icon={Tag}
          isExpanded={isExpanded("vectors")}
          onToggle={() => toggleSection("vectors")}
        >
          <div className="flex flex-wrap gap-2">
            {analysis.attackVectors.map((vector, i) => {
              // Safety check: handle cases where vector might still be an object
              const vectorLabel = typeof vector === 'string' ? vector : (vector as any).vector || JSON.stringify(vector);
              return (
                <span
                  key={i}
                  className="rounded-full border border-border bg-background px-3 py-1 text-xs text-foreground"
                >
                  {vectorLabel}
                </span>
              );
            })}
          </div>
        </CollapsibleSection>
      )}

      {/* Technical Details */}
      {analysis.technicalDetails && (
        <CollapsibleSection
          title="Technical Details"
          icon={FileText}
          isExpanded={isExpanded("technical")}
          onToggle={() => toggleSection("technical")}
        >
          <p className="whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground font-mono">
            {analysis.technicalDetails}
          </p>
        </CollapsibleSection>
      )}

      {/* Compliance Notes */}
      {analysis.complianceNotes && (
        <CollapsibleSection
          title="Compliance Notes"
          icon={Scale}
          isExpanded={isExpanded("compliance")}
          onToggle={() => toggleSection("compliance")}
        >
          <p className="text-sm text-foreground/90">{analysis.complianceNotes}</p>
        </CollapsibleSection>
      )}
    </div>
  );
}

// ─── Collapsible Section helper ──────────────────
function CollapsibleSection({
  title,
  icon: Icon,
  isExpanded,
  onToggle,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  isExpanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="glass-card rounded-xl border border-border/50 bg-muted/20 overflow-hidden">
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between px-5 py-4 text-sm font-bold text-foreground hover:bg-muted/40 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Icon className="h-4 w-4 text-primary" />
          <span className="tracking-wide uppercase text-[11px] text-muted-foreground/80">{title}</span>
        </div>
        {isExpanded ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>
      {isExpanded && <div className="border-t border-border/30 px-5 py-5">{children}</div>}
    </div>
  );
}

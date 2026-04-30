"use client";

import { useState, useEffect } from "react";
import {
  Wand2,
  Loader2,
  X,
  CheckCircle2,
  ExternalLink,
  Copy,
  Check,
  AlertTriangle,
  BookOpen,
  Code2,
  Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAiRemediation } from "./useAiMutations";
import { useViewModal } from "@/Contexts/ViewModalContext";
import { SeverityBadge } from "@/components/layout/SeverityBadge";

export interface AIRemediationViewProps {
  findingId: string;
  findingName: string;
  severity: string;
}

export function AIRemediationView({
  findingId,
  findingName,
  severity,
}: AIRemediationViewProps) {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const { close } = useViewModal();

  const {
    data: guide,
    mutate: fetchGuide,
    isPending,
    isIdle,
  } = useAiRemediation(findingId);

  // Auto-fetch on mount
  useEffect(() => {
    if (isIdle) {
      fetchGuide();
    }
  }, [isIdle, fetchGuide]);

  const copyCode = async (code: string, index: number) => {
    await navigator.clipboard.writeText(code);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const sevColors: Record<string, string> = {
    CRITICAL: "text-red-400 bg-red-500/10 border-red-500/20",
    HIGH: "text-orange-400 bg-orange-500/10 border-orange-500/20",
    MEDIUM: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
    LOW: "text-green-400 bg-green-500/10 border-green-500/20",
  };

  return (
    <div className="flex flex-col h-full bg-background/95">
      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6 custom-scrollbar">
        {isPending ? (
          <div className="flex flex-col items-center gap-4 py-12">
            <div className="relative">
              <div className="h-16 w-16 animate-spin rounded-full border-4 border-muted border-t-primary" />
              <Wand2 className="absolute left-1/2 top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 text-primary" />
            </div>
            <div className="text-center">
              <p className="text-sm font-bold text-foreground">
                Generating remediation guide...
              </p>
              <p className="mt-1 text-xs text-muted-foreground font-medium">
                AI is analyzing the vulnerability and creating step-by-step
                instructions
              </p>
            </div>
          </div>
        ) : guide ? (
          <div className="space-y-8">
            {/* What Is It */}
            <section className="space-y-2">
              <div className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-primary" />
                <h4 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                  What Is It?
                </h4>
              </div>
              <p className="text-sm text-foreground/90 leading-relaxed font-medium wrap-break-word whitespace-normal min-w-0">
                {guide.whatIsIt}
              </p>
            </section>

            {/* Why It Matters */}
            <section className="space-y-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-orange-400" />
                <h4 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                  Why It Matters
                </h4>
              </div>
              <p className="text-sm text-foreground/90 leading-relaxed font-medium wrap-break-word whitespace-normal min-w-0">
                {guide.whyItMatters}
              </p>
            </section>

            {/* Steps */}
            <section className="space-y-3">
              <div className="flex items-center gap-2 mb-3">
                <Code2 className="h-4 w-4 text-emerald-500" />
                <h4 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                  How to Fix ({guide.steps.length} Steps)
                </h4>
              </div>
              <div className="space-y-4">
                {guide.steps.map((step, i) => (
                  <div
                    key={i}
                    className="glass-card rounded-xl border border-border/50 bg-muted/10 overflow-hidden"
                  >
                    <div className="flex items-center gap-3 px-4 py-3 border-b border-border/50 bg-muted/30">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary">
                        {step.step}
                      </span>
                      <h5 className="text-sm font-bold text-foreground">
                        {step.title}
                      </h5>
                    </div>
                    <div className="px-5 py-4 w-full min-w-0">
                      <p className="text-sm text-foreground/80 leading-relaxed font-medium wrap-break-word whitespace-normal min-w-0">
                        {step.description}
                      </p>
                      {step.code && (
                        <div className="mt-4 rounded-lg bg-[#0d1117] border border-border/50 overflow-hidden shadow-sm w-full min-w-0">
                          <div className="flex items-center justify-between px-4 py-2 border-b border-border/50 bg-muted/30">
                            <span className="text-[10px] text-muted-foreground font-mono font-bold uppercase tracking-wider">
                              {step.language || "code"}
                            </span>
                            <button
                              onClick={() => copyCode(step.code!, i)}
                              className="flex items-center gap-1.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors font-bold uppercase tracking-wider"
                            >
                              {copiedIndex === i ? (
                                <>
                                  <Check className="h-3 w-3 text-emerald-500" />
                                  <span className="text-emerald-500">
                                    Copied
                                  </span>
                                </>
                              ) : (
                                <>
                                  <Copy className="h-3 w-3" />
                                  Copy
                                </>
                              )}
                            </button>
                          </div>
                          <div className="w-full min-w-0 overflow-x-auto custom-scrollbar">
                            <pre className="px-4 py-4 text-[11px] text-blue-300 font-mono leading-relaxed inline-block min-w-full">
                              {step.code}
                            </pre>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Verification */}
            {guide.verification && (
              <section className="space-y-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  <h4 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                    How to Verify
                  </h4>
                </div>
                <div className="glass-card rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 w-full min-w-0">
                  <p className="text-sm text-foreground/90 leading-relaxed font-medium wrap-break-word whitespace-normal min-w-0">
                    {guide.verification}
                  </p>
                </div>
              </section>
            )}

            {/* References */}
            {guide.references.length > 0 && (
              <section className="space-y-2">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-primary" />
                  <h4 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                    References
                  </h4>
                </div>
                <div className="space-y-1.5">
                  {guide.references.map((ref, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 text-xs font-medium text-muted-foreground"
                    >
                      <ExternalLink className="h-3 w-3 shrink-0" />
                      <span className="truncate">{ref}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

// Button component to trigger the modal
export function AIRemediationButton({
  findingId,
  findingName,
  severity,
}: {
  findingId: string;
  findingName: string;
  severity: string;
}) {
  const { view } = useViewModal();

  return (
    <button
      onClick={() => {
        view({
          title: "AI Remediation Guide",
          description: (
            <div className="flex items-center gap-2 mt-1">
              <span className="truncate">{findingName}</span>
              <SeverityBadge theme={severity as any} className="px-1.5 py-0 text-[10px] uppercase">
                {severity}
              </SeverityBadge>
            </div>
          ),
          content: (
            <AIRemediationView
              findingId={findingId}
              findingName={findingName}
              severity={severity}
            />
          ),
          noPadding: true,
          maxWidth: "sm:max-w-2xl",
        });
      }}
      className="flex items-center gap-1.5 rounded-lg bg-primary/10 border border-primary/20 px-3 py-1.5 text-xs font-bold text-primary hover:bg-primary/20 transition-all"
    >
      <Wand2 className="h-3 w-3" />
      AI Fix Guide
    </button>
  );
}

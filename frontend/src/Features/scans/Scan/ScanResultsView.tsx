"use client";

import { useMemo, useState } from "react";
import {
  Shield,
  ShieldCheck,
  Bot,
  Terminal,
  Info,
  AlertTriangle,
  Ban,
} from "lucide-react";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

// Modular Components
import { ScanResultSkeletons } from "./ScanResultSkeletons";
import { ScanResultHeader } from "./ScanResultHeader";
import { FindingsSummary } from "./FindingsSummary";
import { FindingsTable } from "./FindingsTable";
import { RawOutputSection } from "./RawOutputSection";
import { ScanDetailsSection } from "./ScanDetailsSection";
import { AIAnalysisCard } from "@/Features/ai/AIAnalysisCard";
import { SeverityBadge } from "@/components/layout/SeverityBadge";

import type { Scan, ScanFinding } from "@/types";

interface ScanResultViewProps {
  scan: Scan;
  findings: ScanFinding[];
  isFindingsPending: boolean;
  actions: {
    generateReport: () => void;
    isGeneratingReport: boolean;
    deleteScan: () => void;
    isDeleting: boolean;
    refresh: () => void;
  };
}

export default function ScanResultsView({
  scan,
  findings,
  isFindingsPending,
  actions,
}: ScanResultViewProps) {
  const router = useRouter();
  const [groupBySeverity, setGroupBySeverity] = useState(false);

  // ─── Grouping Logic ─────────────────────────────────
  const groupedFindings = useMemo(() => {
    if (!groupBySeverity) return null;
    const severityOrder = ["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const;
    const groups: Record<string, ScanFinding[]> = {};
    for (const sev of severityOrder) {
      const items = findings.filter((f) => f.vulnerability?.severity === sev);
      if (items.length > 0) groups[sev] = items;
    }
    return groups;
  }, [findings, groupBySeverity]);

  const isCompleted = scan.status === "COMPLETED";

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Hero Section (Contains status, identity and main actions) */}
      <ScanResultHeader
        scan={scan}
        onGenerateReport={actions.generateReport}
        isGeneratingReport={actions.isGeneratingReport}
        onDelete={async () => {
          actions.deleteScan();
        }}
        isDeleting={actions.isDeleting}
        onRefresh={actions.refresh}
      />

      {/* Summary Section (Completed Only) */}
      {isCompleted && scan.findingsSummary && (
        <FindingsSummary
          summary={scan.findingsSummary}
          groupBySeverity={groupBySeverity}
          onToggleGroupBySeverity={() => setGroupBySeverity(!groupBySeverity)}
        />
      )}

      {/* Status Specific Empty States */}
      {!isCompleted && scan.status === "PENDING" && (
        <div className="glass-card p-12 border border-border/40 bg-muted/5 flex flex-col items-center gap-4 text-center">
          <div className="h-16 w-16 rounded-full border-4 border-border/20 border-t-primary animate-spin" />
          <p className="text-sm font-bold">Waiting for resources...</p>
          <p className="text-xs text-muted-foreground">
            This scan is queued and will begin shortly.
          </p>
        </div>
      )}

      {scan.status === "FAILED" && (
        <div className="glass-card border border-destructive/20 bg-destructive/5 p-12 flex flex-col items-center gap-4 text-center text-destructive">
          <AlertTriangle className="size-12" />
          <p className="text-sm font-bold">Scan Execution Failed</p>
          <p className="text-xs text-muted-foreground max-w-sm font-medium">
            The probe encountered a fatal error. Please check the raw output for
            debug information.
          </p>
        </div>
      )}

      {scan.status === "CANCELLED" && (
        <div className="glass-card p-12 border border-border/40 bg-muted/5 flex flex-col items-center gap-4 text-center">
          <Ban className="size-12 text-muted-foreground/30" />
          <p className="text-sm font-bold">Session Terminated</p>
          <p className="text-xs text-muted-foreground">
            The scan was manually cancelled by a user.
          </p>
        </div>
      )}

      {/* Main Tabs (Findings, AI, Logs, Metadata) */}
      {isCompleted && (
        <Tabs defaultValue="findings" className="w-full">
          <div className="w-full overflow-x-auto pb-2 mb-4 custom-scrollbar">
            <TabsList className="inline-flex w-max min-w-full sm:min-w-0 justify-start border border-border/50 bg-muted/30 p-1">
              <TabsTrigger 
                value="findings" 
                className="group gap-2 px-4 sm:px-6 whitespace-nowrap border border-transparent data-[state=active]:border-border/60 data-[state=active]:bg-background data-[state=active]:shadow-[0_2px_10px_-3px_rgba(0,0,0,0.1)] data-[state=active]:text-foreground data-[state=inactive]:text-muted-foreground/70 transition-all font-medium data-[state=active]:font-bold cursor-pointer"
              >
                <Shield className="size-4 group-data-[state=active]:text-primary transition-colors" /> Findings
              </TabsTrigger>
              <TabsTrigger 
                value="ai" 
                className="group gap-2 px-4 sm:px-6 whitespace-nowrap border border-transparent data-[state=active]:border-border/60 data-[state=active]:bg-background data-[state=active]:shadow-[0_2px_10px_-3px_rgba(0,0,0,0.1)] data-[state=active]:text-foreground data-[state=inactive]:text-muted-foreground/70 transition-all font-medium data-[state=active]:font-bold cursor-pointer"
              >
                <Bot className="size-4 group-data-[state=active]:text-primary transition-colors" /> AI Analysis
              </TabsTrigger>
              <TabsTrigger 
                value="raw" 
                className="group gap-2 px-4 sm:px-6 whitespace-nowrap border border-transparent data-[state=active]:border-border/60 data-[state=active]:bg-background data-[state=active]:shadow-[0_2px_10px_-3px_rgba(0,0,0,0.1)] data-[state=active]:text-foreground data-[state=inactive]:text-muted-foreground/70 transition-all font-medium data-[state=active]:font-bold cursor-pointer"
              >
                <Terminal className="size-4 group-data-[state=active]:text-primary transition-colors" /> Raw Output
              </TabsTrigger>
              <TabsTrigger 
                value="details" 
                className="group gap-2 px-4 sm:px-6 whitespace-nowrap border border-transparent data-[state=active]:border-border/60 data-[state=active]:bg-background data-[state=active]:shadow-[0_2px_10px_-3px_rgba(0,0,0,0.1)] data-[state=active]:text-foreground data-[state=inactive]:text-muted-foreground/70 transition-all font-medium data-[state=active]:font-bold cursor-pointer"
              >
                <Info className="size-4 group-data-[state=active]:text-primary transition-colors" /> Details
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="findings" className="space-y-6 outline-none">
            {isFindingsPending ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <ScanResultSkeletons key={i} />
                ))}
              </div>
            ) : findings.length === 0 ? (
              <div className="glass-card flex flex-col items-center gap-4 py-20 text-center border border-green-500/20 bg-green-500/5 shadow-sm">
                <ShieldCheck className="size-16 text-green-500/50" />
                <h3 className="text-lg font-bold text-green-600">
                  Security Clearance: Green
                </h3>
                <p className="text-xs text-green-600/60 max-w-xs uppercase tracking-widest font-black">
                  No High-Risk Vulnerabilities Detected
                </p>
              </div>
            ) : groupBySeverity && groupedFindings ? (
              <div className="space-y-8 animate-in fade-in duration-500">
                {Object.entries(groupedFindings).map(([severity, items]) => (
                  <div key={severity} className="space-y-3">
                    <div className="flex items-center gap-2 px-1">
                      <SeverityBadge theme={severity as any} className="gap-1.5 px-2 py-0.5 font-bold">
                        {severity}
                        <span className="opacity-60">{items.length}</span>
                      </SeverityBadge>
                    </div>
                    <FindingsTable findings={items} isGrouped />
                  </div>
                ))}
              </div>
            ) : (
              <FindingsTable findings={findings} />
            )}
          </TabsContent>

          <TabsContent value="ai" className="outline-none">
            <AIAnalysisCard scanId={scan.id} />
          </TabsContent>

          <TabsContent value="raw" className="outline-none">
            <RawOutputSection scanId={scan.id} />
          </TabsContent>

          <TabsContent value="details" className="outline-none">
            <ScanDetailsSection scan={scan} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

"use client";

import { Fragment, useState } from "react";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { 
  ChevronDown, 
  ChevronUp, 
  ExternalLink,
  ShieldAlert,
  Terminal,
  FileCode,
  MapPin,
  Sparkles
} from "lucide-react";
import { cn, severityColor, severityDot } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { AIRemediationButton } from "@/Features/ai/AIRemediationModal";
import type { ScanFinding } from "@/types";

interface FindingsTableProps {
  findings: ScanFinding[];
  isGrouped?: boolean;
}

export function FindingsTable({ findings, isGrouped = false }: FindingsTableProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string) => {
    const next = new Set(expandedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedIds(next);
  };

  return (
    <div className="glass-card rounded-xl border border-border/50 overflow-hidden">
      <div className="overflow-x-auto custom-scrollbar">
        <Table className="w-full sm:table-fixed">
          <TableHeader className="bg-muted/30">
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-10" />
            <TableHead className="w-10 px-0" />
            <TableHead className="text-xs font-bold uppercase tracking-widest text-muted-foreground/80">Vulnerability</TableHead>
            <TableHead className="text-xs font-bold uppercase tracking-widest text-muted-foreground/80 hidden sm:table-cell">Category</TableHead>
            <TableHead className="text-xs font-bold uppercase tracking-widest text-muted-foreground/80 hidden md:table-cell">Location</TableHead>
            <TableHead className="text-xs font-bold uppercase tracking-widest text-muted-foreground/80 hidden lg:table-cell">Evidence</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {findings.map((finding) => (
            <Fragment key={finding.id}>
              <TableRow
                className={cn(
                  "cursor-pointer transition-colors group",
                  expandedIds.has(finding.id) ? "bg-muted/40" : "hover:bg-muted/20"
                )}
                onClick={() => toggleExpand(finding.id)}
              >
                <TableCell className="text-center">
                  {expandedIds.has(finding.id) ? (
                    <ChevronUp className="size-4 text-muted-foreground/50 group-hover:text-foreground transition-colors" />
                  ) : (
                    <ChevronDown className="size-4 text-muted-foreground/30 group-hover:text-foreground transition-colors" />
                  )}
                </TableCell>
                <TableCell className="px-0">
                  <div className={cn("size-2 rounded-full mx-auto shadow-sm", severityDot(finding.vulnerability?.severity ?? "LOW"))} />
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs font-semibold text-foreground leading-tight">
                      {finding.vulnerability?.name ?? "Unknown Finding"}
                    </span>
                    {!isGrouped && (
                      <span className={cn(
                        "text-[10px] font-extrabold uppercase tracking-wide",
                        finding.vulnerability?.severity === "CRITICAL" ? "text-red-500" :
                        finding.vulnerability?.severity === "HIGH" ? "text-orange-500" :
                        finding.vulnerability?.severity === "MEDIUM" ? "text-amber-500" : "text-blue-500"
                      )}>
                        {finding.vulnerability?.severity}
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="hidden sm:table-cell">
                  <span className="text-xs font-medium text-muted-foreground opacity-90">
                    {finding.vulnerability?.category || "Uncategorized"}
                  </span>
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  <div className="flex items-center gap-1.5 text-xs font-mono text-muted-foreground truncate max-w-[120px] sm:max-w-[200px]">
                    <MapPin className="size-3.5 shrink-0 opacity-50" />
                    {finding.location || "N/A"}
                  </div>
                </TableCell>
                <TableCell className="hidden lg:table-cell">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground opacity-70 italic truncate max-w-[150px]">
                    <FileCode className="size-3.5 shrink-0" />
                    {finding.evidence ? finding.evidence.slice(0, 40) + "..." : "No snippet"}
                  </div>
                </TableCell>
              </TableRow>

              {expandedIds.has(finding.id) && (
                <TableRow>
                  <TableCell colSpan={6} className="p-0 border-t border-border/30">
                    <div className="bg-muted/10 p-5 sm:p-6 space-y-6 animate-in fade-in duration-300 w-full min-w-0">
                      {/* Mobile Additional Info */}
                      <div className="md:hidden space-y-3 pb-4 mb-4 border-b border-border/10">
                        {finding.vulnerability?.category && (
                          <div className="space-y-1 sm:hidden">
                            <h4 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/60">Category</h4>
                            <p className="text-xs wrap-break-word">{finding.vulnerability.category}</p>
                          </div>
                        )}
                        {finding.location && (
                          <div className="space-y-1">
                            <h4 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/60">Location</h4>
                            <p className="text-xs font-mono text-muted-foreground break-all">{finding.location}</p>
                          </div>
                        )}
                      </div>

                      {/* Detailed Description */}
                      {finding.vulnerability?.description && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-muted-foreground/60">
                            <ShieldAlert className="size-3.5" />
                            <h4 className="text-[11px] font-bold uppercase tracking-widest leading-none">Security Analysis</h4>
                          </div>
                          <p className="text-xs text-foreground/80 leading-relaxed font-medium wrap-break-word whitespace-normal min-w-0">
                            {finding.vulnerability.description}
                          </p>
                        </div>
                      )}

                      {/* Evidence / Code Snippet */}
                      {finding.evidence && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-muted-foreground/60">
                            <Terminal className="size-3.5" />
                            <h4 className="text-[11px] font-bold uppercase tracking-widest leading-none">Vulnerability Evidence</h4>
                          </div>
                          <div className="relative group w-full min-w-0 max-w-full">
                            <pre className="bg-[#0d1117] border border-white/5 p-4 text-[11px] text-blue-300 font-mono whitespace-pre-wrap wrap-break-word leading-relaxed shadow-sm w-full min-w-0 overflow-x-auto">
                              {finding.evidence}
                            </pre>
                            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button variant="ghost" size="xs" className="h-6 w-6 p-0 hover:bg-white/10" onClick={() => navigator.clipboard.writeText(finding.evidence!)} title="Copy Evidence">
                                <ExternalLink className="size-3 text-white/40" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Remediation Guide */}
                      {finding.vulnerability?.remediation && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-green-500/60">
                            <Sparkles className="size-3.5" />
                            <h4 className="text-[11px] font-bold uppercase tracking-widest leading-none">Remediation Guide</h4>
                          </div>
                          <div className="rounded-lg bg-green-500/5 border border-green-500/10 p-3 w-full min-w-0">
                            <p className="text-xs text-green-600/90 leading-relaxed font-medium italic wrap-break-word whitespace-normal min-w-0">
                              {finding.vulnerability.remediation}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* AI Assistant Integration */}
                      <div className="pt-2">
                        <AIRemediationButton
                          findingId={finding.id}
                          findingName={finding.vulnerability?.name ?? "Unknown"}
                          severity={finding.vulnerability?.severity ?? "MEDIUM"}
                        />
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </Fragment>
          ))}
        </TableBody>
      </Table>
      </div>
    </div>
  );
}

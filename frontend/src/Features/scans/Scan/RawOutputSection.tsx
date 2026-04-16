"use client";

import { useState } from "react";
import { useScanRawOutput } from "@/Features/scans/useScans";
import { Skeleton } from "@/components/ui/skeleton";
import { Terminal, Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface RawOutputSectionProps {
  scanId: string;
}

export function RawOutputSection({ scanId }: RawOutputSectionProps) {
  const [copied, setCopied] = useState(false);

  const { content: rawOutput, isPending } = useScanRawOutput(scanId);

  const handleCopy = async () => {
    if (!rawOutput) return;
    await navigator.clipboard.writeText(rawOutput);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-80 w-full" />
      </div>
    );
  }

  return (
    <div className=" overflow-hidden border border-border/50 bg-[#0d1117] shadow-xl animate-in fade-in duration-300">
      {/* Terminal Header */}
      <div className="flex items-center justify-between bg-zinc-950 border-b border-white/5 px-4 py-3">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 px-0.5">
            <span className="h-2.5 w-2.5 rounded-full bg-red-500/60 shadow-inner" />
            <span className="h-2.5 w-2.5 rounded-full bg-yellow-500/60 shadow-inner" />
            <span className="h-2.5 w-2.5 rounded-full bg-green-500/60 shadow-inner" />
          </div>
          <div className="flex items-center gap-2">
            <Terminal className="size-3.5 text-zinc-500" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">
              Scanner Shell
            </span>
          </div>
        </div>
        <button
          onClick={handleCopy}
          className={cn(
            "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 transition-all outline-none",
            copied
              ? "bg-green-500/10 text-green-400 border border-green-500/20"
              : "text-zinc-400 hover:text-zinc-100 hover:bg-white/5 border border-transparent",
          )}
        >
          {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
          <span className="text-[10px] font-bold uppercase tracking-widest">
            {copied ? "Copied" : "Copy Output"}
          </span>
        </button>
      </div>

      {/* Terminal Content */}
      <div className="p-5 font-mono text-[11px] leading-relaxed text-blue-100/80 max-h-[500px] overflow-auto custom-scrollbar bg-black/20">
        <pre className="whitespace-pre-wrap break-all">
          {rawOutput || "No session logs recorded."}
        </pre>
      </div>
    </div>
  );
}

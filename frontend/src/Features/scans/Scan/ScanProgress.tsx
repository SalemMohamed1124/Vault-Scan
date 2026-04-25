"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  Shield,
  Globe,
  Lock,
  Server,
  CheckCircle2,
  AlertTriangle,
  Zap,
  Bug,
  Eye,
  KeyRound,
  FileWarning,
  Activity,
  Radio,
  ShieldAlert,
  Database,
  Code2,
  Cookie,
  Fingerprint,
  Network,
  AlertOctagon,
  ChevronRight,
  Terminal,
} from "lucide-react";
import { SeverityBadge } from "@/components/layout/SeverityBadge";
import { cn } from "@/lib/utils";
import { getAccessToken } from "@/Services/auth";

interface ScanProgressProps {
  scanId: string;
  onComplete?: () => void;
}

// Simulated live checks for visual effect between real SSE updates
const SIMULATED_CHECKS = [
  {
    text: "Probing TCP ports 1-1000...",
    icon: Network,
    color: "text-blue-400",
  },
  {
    text: "Checking SSL certificate validity...",
    icon: Lock,
    color: "text-primary",
  },
  {
    text: "Testing SQL injection payloads...",
    icon: Database,
    color: "text-red-400",
  },
  {
    text: "Sending XSS reflection probes...",
    icon: Code2,
    color: "text-purple-400",
  },
  {
    text: "Analyzing CSRF token presence...",
    icon: ShieldAlert,
    color: "text-amber-400",
  },
  {
    text: "Crawling target for endpoints...",
    icon: Globe,
    color: "text-cyan-400",
  },
  {
    text: "Testing authentication bypass...",
    icon: KeyRound,
    color: "text-red-400",
  },
  {
    text: "Checking cookie security flags...",
    icon: Cookie,
    color: "text-yellow-400",
  },
  {
    text: "Detecting server fingerprint...",
    icon: Fingerprint,
    color: "text-blue-400",
  },
  { text: "Testing CORS policy...", icon: Globe, color: "text-violet-400" },
  {
    text: "Checking clickjacking protection...",
    icon: Shield,
    color: "text-indigo-400",
  },
  {
    text: "Testing CRLF header injection...",
    icon: Terminal,
    color: "text-rose-400",
  },
  {
    text: "Analyzing security headers...",
    icon: FileWarning,
    color: "text-orange-400",
  },
  {
    text: "Scanning for sensitive files...",
    icon: Eye,
    color: "text-pink-400",
  },
  {
    text: "Checking directory listing...",
    icon: Server,
    color: "text-orange-400",
  },
  { text: "Testing rate limiting...", icon: Activity, color: "text-sky-400" },
  {
    text: "Probing GraphQL endpoints...",
    icon: Database,
    color: "text-pink-400",
  },
  {
    text: "Checking JWT vulnerabilities...",
    icon: KeyRound,
    color: "text-emerald-400",
  },
  { text: "Testing NoSQL injection...", icon: Database, color: "text-red-400" },
  {
    text: "Analyzing WAF configuration...",
    icon: Shield,
    color: "text-emerald-400",
  },
  {
    text: "Checking host header injection...",
    icon: Server,
    color: "text-cyan-400",
  },
  {
    text: "Testing prototype pollution...",
    icon: Code2,
    color: "text-violet-400",
  },
  {
    text: "Scanning for information disclosure...",
    icon: Eye,
    color: "text-pink-400",
  },
  {
    text: "Testing file upload security...",
    icon: FileWarning,
    color: "text-red-400",
  },
  {
    text: "Checking open redirect vectors...",
    icon: Globe,
    color: "text-amber-400",
  },
  { text: "Testing SSRF payloads...", icon: Network, color: "text-red-400" },
  {
    text: "Analyzing error page disclosure...",
    icon: AlertTriangle,
    color: "text-orange-400",
  },
  {
    text: "Checking deserialization endpoints...",
    icon: Code2,
    color: "text-rose-400",
  },
  {
    text: "Testing command injection...",
    icon: Terminal,
    color: "text-red-400",
  },
  { text: "Validating HTTPS redirect...", icon: Lock, color: "text-green-400" },
];

interface LiveLine {
  id: number;
  text: string;
  icon: typeof Bug;
  color: string;
  type: "check" | "finding" | "phase";
  severity?: string;
}

function extractFindingsCount(phase: string): number | null {
  const match = phase.match(/(\d+)\s+(?:issues?\s+found|raw\s+findings)/);
  return match ? parseInt(match[1], 10) : null;
}

export function ScanProgress({ scanId, onComplete }: ScanProgressProps) {
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState("Initializing...");
  const [findingsCount, setFindingsCount] = useState(0);
  const [startTime] = useState(Date.now());
  const [elapsed, setElapsed] = useState(0);
  const [liveLines, setLiveLines] = useState<LiveLine[]>([]);
  const [lineIdCounter, setLineIdCounter] = useState(0);
  const logEndRef = useRef<HTMLDivElement>(null);
  const onCompleteRef = useRef(onComplete);
  const simIndexRef = useRef(0);
  const lastPhaseRef = useRef("");
  onCompleteRef.current = onComplete;

  // Add a live line
  const addLine = useCallback((line: Omit<LiveLine, "id">) => {
    setLineIdCounter((prev) => {
      const newId = prev + 1;
      setLiveLines((lines) => {
        const updated = [...lines, { ...line, id: newId }];
        return updated.slice(-50); // Keep last 50
      });
      return newId;
    });
  }, []);

  // Elapsed timer
  useEffect(() => {
    const timer = setInterval(
      () => setElapsed(Math.floor((Date.now() - startTime) / 1000)),
      1000,
    );
    return () => clearInterval(timer);
  }, [startTime]);

  // Simulated live checks (visual filler between real SSE updates)
  useEffect(() => {
    const interval = setInterval(() => {
      if (progress >= 100) return;
      const idx = simIndexRef.current % SIMULATED_CHECKS.length;
      const check = SIMULATED_CHECKS[idx];
      simIndexRef.current++;
      addLine({
        text: check.text,
        icon: check.icon,
        color: check.color,
        type: "check",
      });
    }, 2500);
    return () => clearInterval(interval);
  }, [progress, addLine]);

  // SSE connection
  useEffect(() => {
    const token = getAccessToken();
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
    const url = `${baseUrl}/api/scans/${scanId}/progress?token=${encodeURIComponent(token ?? "")}`;
    const es = new EventSource(url);

    es.addEventListener("progress", (e) => {
      try {
        const data = JSON.parse(e.data) as {
          progress: number;
          phase: string;
          status: string;
        };
        setProgress(data.progress);
        if (data.phase && data.phase !== lastPhaseRef.current) {
          lastPhaseRef.current = data.phase;
          setPhase(data.phase);
          const count = extractFindingsCount(data.phase);
          if (count !== null) setFindingsCount(count);

          // Add phase as a prominent line
          addLine({
            text: data.phase,
            icon: data.phase.toLowerCase().includes("complete")
              ? CheckCircle2
              : Zap,
            color: data.phase.toLowerCase().includes("complete")
              ? "text-emerald-400"
              : "text-sky-400",
            type: "phase",
          });

          // Simulate finding discoveries when count increases
          if (count !== null && count > 0) {
            const findingTexts = [
              "Vulnerability detected in response headers",
              "Security misconfiguration identified",
              "Potential injection point found",
              "Missing security control detected",
              "Sensitive data exposure risk found",
            ];
            const sevs = ["HIGH", "MEDIUM", "LOW", "MEDIUM", "HIGH"];
            for (let i = 0; i < Math.min(3, count); i++) {
              setTimeout(
                () => {
                  addLine({
                    text: findingTexts[i % findingTexts.length],
                    icon: AlertOctagon,
                    color: "text-red-400",
                    type: "finding",
                    severity: sevs[i % sevs.length],
                  });
                },
                (i + 1) * 800,
              );
            }
          }
        }
        if (["COMPLETED", "FAILED", "CANCELLED"].includes(data.status)) {
          es.close();
          onCompleteRef.current?.();
        }
      } catch {
        /* ignore */
      }
    });

    es.addEventListener("complete", () => {
      setProgress(100);
      setPhase("Scan complete");
      es.close();
      onCompleteRef.current?.();
    });

    es.onerror = () => {};
    return () => {
      es.close();
    };
  }, [scanId, addLine]);

  // Auto-scroll
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [liveLines]);

  const clampedProgress = Math.min(Math.max(0, progress), 100);
  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return m > 0
      ? `${m}:${sec.toString().padStart(2, "0")}`
      : `0:${sec.toString().padStart(2, "0")}`;
  };
  const eta =
    progress > 5
      ? Math.max(0, Math.round((elapsed / progress) * 100 - elapsed))
      : 0;

  return (
    <div className="space-y-3">
      {/* Compact stats bar */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {/* Live dot */}
          <div className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
          </div>
          <span className="text-xs font-bold text-foreground tracking-widest">
            SCANNING
          </span>
          <span className="text-[11px] text-muted-foreground tabular-nums">
            {formatTime(elapsed)}
          </span>
          {eta > 0 && (
            <span className="text-[11px] text-muted-foreground/60 tabular-nums">
              ETA ~{formatTime(eta)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {findingsCount > 0 && (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-red-500/10 border border-red-500/20">
              <AlertTriangle className="h-3 w-3 text-red-400" />
              <span className="text-[11px] font-bold text-red-400 tabular-nums">
                {findingsCount}
              </span>
              <span className="text-[10px] text-red-400/60 font-bold uppercase tracking-tight">
                issues
              </span>
            </div>
          )}
          <span className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-cyan-400 tabular-nums">
            {Math.round(clampedProgress)}%
          </span>
        </div>
      </div>

      {/* Thin progress bar */}
      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-sky-500 via-cyan-400 to-emerald-500 transition-all duration-700 relative overflow-hidden"
          style={{ width: `${clampedProgress}%` }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
        </div>
      </div>

      {/* Live Terminal Feed - the main feature */}
      <div className="rounded-xl border border-white/10 bg-[#09090b] overflow-hidden font-mono shadow-2xl">
        {/* Terminal header */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-white/[0.05] bg-white/[0.03]">
          <div className="flex gap-1.5">
            <div className="h-2.5 w-2.5 rounded-full bg-[#ff5f56]" />
            <div className="h-2.5 w-2.5 rounded-full bg-[#ffbd2e]" />
            <div className="h-2.5 w-2.5 rounded-full bg-[#27c93f]" />
          </div>
          <span className="text-[10px] text-slate-400 font-bold ml-2 tracking-tight">
            VaultScan Terminal — {phase}
          </span>
          <div className="flex-1" />
          <Radio className="h-3 w-3 text-red-400 animate-pulse" />
          <span className="text-[10px] text-red-400 font-bold">LIVE</span>
        </div>

        {/* Terminal body */}
        <div className="h-[300px] overflow-y-auto scrollbar-thin p-3 space-y-0.5 custom-scrollbar">
          {liveLines.map((line) => {
            const Icon = line.icon;
            return (
              <div
                key={line.id}
                className={cn(
                  "flex items-start gap-3 px-2 py-1 rounded text-[11px] animate-fade-in-up",
                  line.type === "phase" &&
                    "bg-sky-500/10 border border-sky-500/10 mt-2 mb-2 py-2",
                  line.type === "finding" && "bg-red-500/5",
                )}
                style={{ animationDuration: "300ms" }}
              >
                {/* Timestamp */}
                <span className="text-[10px] text-slate-500 tabular-nums shrink-0 w-10 pt-0.5 font-medium">
                  {formatTime(Math.floor((Date.now() - startTime) / 1000))}
                </span>

                {/* Icon */}
                <Icon
                  className={cn("h-3.5 w-3.5 shrink-0 mt-0.5", line.color)}
                />

                {/* Content */}
                <div className="flex-1 min-w-0">
                  {line.type === "phase" ? (
                    <span className="text-sky-400 font-bold">{line.text}</span>
                  ) : line.type === "finding" ? (
                    <span className="flex items-center gap-2">
                      <span className="text-red-400 font-medium">
                        {line.text}
                      </span>
                      {line.severity && (
                        <SeverityBadge
                          theme={line.severity as any}
                          className="text-[9px] px-1.5 py-0.5 leading-none h-auto"
                        >
                          {line.severity}
                        </SeverityBadge>
                      )}
                    </span>
                  ) : (
                    <span className="text-slate-300 font-medium">
                      {line.text}
                    </span>
                  )}
                </div>

                {/* Status indicator */}
                {line.type === "check" && (
                  <CheckCircle2 className="h-3 w-3 text-primary/40 shrink-0 mt-0.5" />
                )}
                {line.type === "finding" && (
                  <AlertOctagon className="h-3 w-3 text-red-400/60 shrink-0 mt-0.5" />
                )}
              </div>
            );
          })}

          {/* Cursor blink */}
          <div className="flex items-center gap-2 px-2 py-1">
            <span className="text-[10px] text-slate-600 tabular-nums w-10">
              {formatTime(elapsed)}
            </span>
            <ChevronRight className="h-3 w-3 text-primary" />
            <span className="inline-block w-2 h-4 bg-primary animate-pulse" />
          </div>

          <div ref={logEndRef} />
        </div>
      </div>
    </div>
  );
}

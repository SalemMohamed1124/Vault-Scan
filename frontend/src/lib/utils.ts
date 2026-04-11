import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ─── Severity helpers ────────────────────────────
export const severityColor = (severity: string): string =>
  ({
    CRITICAL: "text-red-400 bg-red-400/10 border-red-400/20",
    HIGH: "text-orange-400 bg-orange-400/10 border-orange-400/20",
    MEDIUM: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20",
    LOW: "text-green-400 bg-green-400/10 border-green-400/20",
  })[severity] ?? "";

export const severityDot = (severity: string): string =>
  ({
    CRITICAL: "bg-[#FF4D6A]",
    HIGH: "bg-[#FF8C42]",
    MEDIUM: "bg-[#FFD166]",
    LOW: "bg-[#06D6A0]",
  })[severity] ?? "bg-gray-500";

export const riskScoreColor = (score: number): string =>
  score >= 75
    ? "#FF4D6A"
    : score >= 50
      ? "#FF8C42"
      : score >= 25
        ? "#FFD166"
        : "#06D6A0";

// ─── Status badge ────────────────────────────────
export const statusBadge = (status: string): string =>
  ({
    PENDING: "bg-slate-500/20 text-slate-300",
    RUNNING: "bg-blue-500/20 text-blue-300 animate-pulse",
    COMPLETED: "bg-green-500/20 text-green-300",
    CANCELLED: "bg-slate-500/20 text-slate-300",
    FAILED: "bg-red-500/20 text-red-300",
  })[status] ?? "";

// ─── Date / time helpers ─────────────────────────
export function formatRelativeTime(dateStr?: string | Date | null): string {
  if (!dateStr) return "N/A";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return "N/A";
  
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

export function formatDate(dateStr?: string | Date | null): string {
  if (!dateStr) return "N/A";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return "N/A";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatDateTime(dateStr?: string | Date | null): string {
  if (!dateStr) return "N/A";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return "N/A";
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDuration(startStr?: string | Date | null, endStr?: string | Date | null): string {
  if (!startStr || !endStr) return "--";
  const start = new Date(startStr).getTime();
  const end = new Date(endStr).getTime();
  if (isNaN(start) || isNaN(end)) return "--";
  
  const diffSec = Math.max(0, Math.floor((end - start) / 1000));

  if (diffSec < 60) return `${diffSec}s`;
  const min = Math.floor(diffSec / 60);
  const sec = diffSec % 60;
  if (min < 60) return `${min}m ${sec}s`;
  const hr = Math.floor(min / 60);
  const remMin = min % 60;
  return `${hr}h ${remMin}m`;
}

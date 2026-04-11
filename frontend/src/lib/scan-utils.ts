import type { Scan } from "@/types";

export function calculateScanStats(scans: Scan[], total: number) {
  const runningNow = scans.filter((s) => s.status === "RUNNING").length;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const completedToday = scans.filter((s) => {
    if (s.status !== "COMPLETED" || !s.completedAt) return false;
    return new Date(s.completedAt) >= today;
  }).length;

  const completedWithDuration = scans.filter((s) => s.startedAt && s.completedAt);
  let avgDuration = "--";
  if (completedWithDuration.length > 0) {
    const totalMs = completedWithDuration.reduce((sum, s) => {
      return sum + (new Date(s.completedAt!).getTime() - new Date(s.startedAt!).getTime());
    }, 0);
    const avgMs = totalMs / completedWithDuration.length;
    const avgSec = Math.floor(avgMs / 1000);
    if (avgSec < 60) avgDuration = `${avgSec}s`;
    else if (avgSec < 3600) avgDuration = `${Math.floor(avgSec / 60)}m ${avgSec % 60}s`;
    else avgDuration = `${Math.floor(avgSec / 3600)}h ${Math.floor((avgSec % 3600) / 60)}m`;
  }

  return { total, runningNow, completedToday, avgDuration };
}

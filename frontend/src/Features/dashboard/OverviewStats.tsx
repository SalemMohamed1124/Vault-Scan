"use client";

import { useDashboardStats } from "./useDashboardData";
import { Summary } from "@/components/layout/Summary";
import { Server, Radar, Bug, AlertTriangle } from "lucide-react";
import SecurityScoreCard from "./SecurityScoreCard";

export default function OverviewStats() {
  const { stats, isPending } = useDashboardStats();

  return (
    <Summary data={[]}>
      <Summary.Card
        label="Total Assets"
        variant="none"
        icon={<Server className="size-4" />}
        counts={stats?.totalAssets || 0}
        className="glass-card bg-blue-500/5!"
      />
      <Summary.Card
        label="Active Scans"
        variant="informative"
        icon={<Radar className="size-4" />}
        counts={stats?.activeScans || 0}
        className="glass-card"
      />
      <Summary.Card
        label="Open Findings"
        variant="medium"
        icon={<Bug className="size-4" />}
        counts={stats?.openFindings || 0}
      />
      <Summary.Card
        label="Critical Issues"
        variant="critical"
        icon={<AlertTriangle className="size-4" />}
        counts={stats?.criticalIssues || 0}
      />
      <SecurityScoreCard />
    </Summary>
  );
}

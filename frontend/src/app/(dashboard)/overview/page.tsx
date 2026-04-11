"use client";

import OverviewStats from "@/Features/dashboard/OverviewStats";
import { AIInsightsCard } from "@/Features/ai/AIInsightsCard";
import VulnTrendChart from "@/Features/dashboard/VulnTrendChart";
import ScanActivityChart from "@/Features/dashboard/ScanActivityChart";
import TopVulnerabilities from "@/Features/dashboard/TopVulnerabilities";
import RecentActivity from "@/Features/dashboard/RecentActivity";
import RecentScansTable from "@/Features/dashboard/RecentScansTable";
import QuickActions from "@/Features/dashboard/QuickActions";

export default function OverviewPage() {
  return (
    <div className="w-full space-y-6 pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Overview</h1>
          <h2 className="text-muted-foreground">
            Security Posture & Operations Intelligence
          </h2>
        </div>
      </div>

      <OverviewStats />
      <QuickActions />

      <AIInsightsCard />

      {/* Charts Row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <VulnTrendChart />
        <ScanActivityChart />
      </div>

      {/* Intelligence Row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <TopVulnerabilities />
        <RecentActivity />
      </div>
      <RecentScansTable />
    </div>
  );
}

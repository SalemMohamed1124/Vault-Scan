"use client";

import { useVulnTrends } from "./useDashboardData";
import { TrendingUp, BarChart3 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const tooltipStyle = {
  backgroundColor: "rgba(10, 10, 18, 0.95)",
  border: "1px solid rgba(255, 255, 255, 0.1)",
  borderRadius: "0px",
  color: "#fff",
  fontSize: "10px",
  backdropFilter: "blur(8px)",
  boxShadow: "none",
  padding: "8px 12px",
};

export default function VulnTrendChart() {
  const { data: trends, isLoading } = useVulnTrends();

  if (isLoading) {
    return (
      <div className="glass-card p-5 flex flex-col gap-5 h-[345px] animate-pulse">
        <div className="flex items-center gap-2">
          <div className="size-8 bg-primary/10 border border-primary/10 rounded" />
          <div className="h-4 w-24 bg-muted/20 rounded" />
        </div>
        <div className="flex-1 w-full bg-muted/10 rounded" />
      </div>
    );
  }

  const formatChartDate = (date: string) => {
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="glass-card p-5 flex flex-col gap-5 shadow-none">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="size-8 bg-primary/10 flex items-center justify-center text-primary border border-primary/10">
            <TrendingUp className="size-4" />
          </div>
          <div className="flex flex-col">
            <h3 className="text-sm font-black uppercase tracking-tight">
              Risk Trends
            </h3>
          </div>
        </div>
      </div>

      <div className="h-64 w-full min-w-0 overflow-hidden">
        {trends && trends.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%" debounce={300}>
            <AreaChart
              data={trends}
              margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
            >
              <defs>
                <linearGradient id="colorCrit" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorHigh" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f97316" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(255,255,255,0.03)"
                vertical={false}
              />
              <XAxis
                dataKey="date"
                tickFormatter={formatChartDate}
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#64748b", fontSize: 10, fontWeight: 700 }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#64748b", fontSize: 10, fontWeight: 700 }}
              />
              <Tooltip contentStyle={tooltipStyle} />
              <Area
                type="monotone"
                dataKey="critical"
                stroke="#ef4444"
                strokeWidth={3}
                fillOpacity={1}
                fill="url(#colorCrit)"
                stackId="1"
                isAnimationActive={false}
              />
              <Area
                type="monotone"
                dataKey="high"
                stroke="#f97316"
                strokeWidth={3}
                fillOpacity={1}
                fill="url(#colorHigh)"
                stackId="1"
                isAnimationActive={false}
              />
              <Area
                type="monotone"
                dataKey="medium"
                stroke="#f59e0b"
                strokeWidth={2}
                stackId="1"
                fill="transparent"
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center flex-col gap-2 opacity-30">
            <BarChart3 className="size-12" />
            <p className="text-xs font-black uppercase tracking-widest">
              Insufficient Data
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

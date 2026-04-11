"use client";

import { useScanActivity } from "./useDashboardData";
import { Activity, BarChart3 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer
} from "recharts";

const tooltipStyle = {
  backgroundColor: "rgba(10, 10, 18, 0.95)",
  border: "1px solid rgba(255, 255, 255, 0.1)",
  borderRadius: "0px",
  color: "#fff",
  fontSize: "10px",
  backdropFilter: "blur(8px)",
  padding: "8px 12px",
};

export default function ScanActivityChart() {
  const { data: activity, isLoading } = useScanActivity();

  if (isLoading) return <Skeleton className="h-[320px]" />;

  const formatChartDate = (date: string) => {
    return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  return (
    <div className="glass-card p-5 flex flex-col gap-5 shadow-none">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="size-8 bg-blue-500/10 flex items-center justify-center text-blue-500 border border-blue-500/10">
            <Activity className="size-4" />
          </div>
          <div className="flex flex-col">
            <h3 className="text-sm font-black uppercase tracking-tight">Scan Volume</h3>
          </div>
        </div>
      </div>

      <div className="h-64 w-full min-w-0 overflow-hidden">
        {activity && activity.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%" debounce={300}>
            <BarChart data={activity} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
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
              <Tooltip cursor={{ fill: 'rgba(59, 130, 246, 0.05)' }} contentStyle={tooltipStyle} />
              <Bar dataKey="completed" fill="#3b82f6" radius={[0, 0, 0, 0]} barSize={12} isAnimationActive={false} />
              <Bar dataKey="failed" fill="#ef4444" radius={[0, 0, 0, 0]} barSize={12} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center flex-col gap-2 opacity-30">
             <BarChart3 className="size-12" />
             <p className="text-xs font-black uppercase tracking-widest">Queue Empty</p>
          </div>
        )}
      </div>
    </div>
  );
}

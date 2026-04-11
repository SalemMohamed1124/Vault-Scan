"use client";

import { Plus, Upload, Play, CalendarClock, FileText } from "lucide-react";
import { useAssetFormModals } from "@/Features/assets/useAssetFormModals";
import { useScanFormModals } from "@/Features/scans/useScanFormModals";
import { useScheduleFormModals } from "@/Features/schedule/useScheduleFormModals";
import { useReportFormModals } from "@/Features/reports/useReportFormModals";

type QuickAction = {
  label: string;
  description: string;
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  onClick: () => void;
};

export default function QuickActions() {
  const { openCreateModal: openAddAsset, openBulkCreateModal } =
    useAssetFormModals();
  const { openCreateModal: openStartScan } = useScanFormModals();
  const { openNew: openNewSchedule } = useScheduleFormModals();
  const { openGenerate: openGenerateReport } = useReportFormModals();

  const actions: QuickAction[] = [
    {
      label: "Add Asset",
      description: "Register a new monitored asset",
      icon: Plus,
      iconColor: "text-blue-500",
      iconBg: "bg-blue-500/10 border-blue-500/20",
      onClick: openAddAsset,
    },
    {
      label: "Bulk Import",
      description: "Import multiple assets at once",
      icon: Upload,
      iconColor: "text-indigo-500",
      iconBg: "bg-indigo-500/10 border-indigo-500/20",
      onClick: openBulkCreateModal,
    },
    {
      label: "Start Scan",
      description: "Launch a new security scan",
      icon: Play,
      iconColor: "text-primary",
      iconBg: "bg-primary/10 border-primary/20",
      onClick: openStartScan,
    },
    {
      label: "New Schedule",
      description: "Automate recurring scans",
      icon: CalendarClock,
      iconColor: "text-emerald-500",
      iconBg: "bg-emerald-500/10 border-emerald-500/20",
      onClick: openNewSchedule,
    },
    {
      label: "Generate Report",
      description: "Create an investigation report",
      icon: FileText,
      iconColor: "text-amber-500",
      iconBg: "bg-amber-500/10 border-amber-500/20",
      onClick: openGenerateReport,
    },
  ];

  return (
    <div className="glass-card p-4 sm:p-6 flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
        <div>
          <h3 className="text-sm font-semibold text-foreground">
            Quick Actions
          </h3>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <button
              key={action.label}
              onClick={action.onClick}
              className="group flex flex-row lg:flex-col lg:items-center items-center gap-3 lg:gap-2 p-3 lg:p-4 w-full text-left lg:text-center border border-border/50 bg-muted/5 cursor-pointer transition-colors hover:bg-muted/10"
            >
              <div
                className={`size-8 lg:size-10 flex items-center justify-center shrink-0 border ${action.iconBg} ${action.iconColor}`}
              >
                <Icon className="size-4 lg:size-5" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-[12px] lg:text-[13px] font-bold text-foreground leading-tight">
                  {action.label}
                </span>
                <span className="text-[10px] text-muted-foreground leading-tight lg:hidden xl:block">
                  {action.description}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

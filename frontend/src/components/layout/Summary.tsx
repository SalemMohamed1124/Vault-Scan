"use client";

import React, { type ReactElement } from "react";
import { cn } from "@/lib/utils";

type SummaryData = Record<string, unknown>[];

type SummaryVariant =
  | "critical"
  | "high"
  | "medium"
  | "low"
  | "none"
  | "informative"
  | "success";

type CardProps = {
  label?: string;
  sublabel?: string;
  icon?: ReactElement;
  find?: {
    column: string;
    value: string;
  };
  variant: SummaryVariant;
  data?: SummaryData;
  counts?: number | string;
  className?: string;
};

const variants: Record<SummaryVariant, string> = {
  critical: "bg-red-500/5 border-red-500/30 text-red-500",
  high: "bg-orange-500/5 border-orange-500/30 text-orange-500",
  medium: "bg-amber-500/5 border-amber-500/30 text-amber-500",
  low: "bg-blue-500/5 border-blue-500/30 text-blue-500",
  none: "bg-card border-border text-foreground",
  informative: "bg-primary/5 border-primary/30 text-primary",
  success: "bg-emerald-500/5 border-emerald-500/30 text-emerald-500",
};

function SummaryRoot({
  children,
  data,
}: {
  children: React.ReactNode;
  data: SummaryData;
}) {
  return (
    <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(200px,1fr))]">
      {React.Children.map(children, (child) => {
        if (React.isValidElement(child)) {
          return React.cloneElement(child as ReactElement<CardProps>, {
            data,
          });
        }
        return child;
      })}
    </div>
  );
}

function SummaryCard({
  label,
  sublabel,
  icon,
  find,
  variant = "none",
  data,
  counts,
  className,
}: CardProps) {
  if (!data && !counts) return null;
  let countValue: number | string | undefined;
  if (counts) {
    countValue = counts;
  } else if (find) {
    countValue = data?.filter((row) => row[find.column] === find.value).length;
  }
  if (!countValue) return null;

  return (
    <div
      className={cn(
        variants[variant],
        "p-6 border-l-2 border bg-card rounded-none flex-1 flex flex-col justify-between gap-4",
        className,
      )}
    >
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] font-bold tracking-widest text-muted-foreground uppercase opacity-80">
            {label || find?.column}
          </span>
          {icon && (
            <div className="text-muted-foreground opacity-50">{icon}</div>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <span className="font-display text-5xl font-bold tracking-tighter text-foreground antialiased ">
          {countValue}
        </span>
        <div className="text-[10px] font-bold text-muted-foreground/40 uppercase tracking-widest">
          {sublabel || find?.value || "TOTAL_COUNT"}
        </div>
      </div>
    </div>
  );
}

export const Summary = Object.assign(SummaryRoot, {
  Card: SummaryCard,
});

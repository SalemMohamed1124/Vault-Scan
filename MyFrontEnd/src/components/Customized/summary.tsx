import React, { type ReactElement } from "react";

type data = Record<string, any>[];

type variant = "critical" | "high" | "medium" | "low" | "none" | "informative";

type CardProps = {
  label?: string;
  sublabel?: string;
  icon?: ReactElement;
  find?: {
    column: string;
    value: any;
  };
  variant: variant;
  data?: data;
  counts?: number | string;
};

const variants: Record<variant, string> = {
  critical: "bg-card border-destructive/30 text-destructive",
  high: "bg-card border-primary/30 text-primary",
  medium: "bg-card border-orange-500/30 text-orange-500",
  low: "bg-card border-blue-500/30 text-blue-500",
  none: "bg-card border-border text-foreground",
  informative: "bg-card border-primary/30 text-primary",
};

function SummaryRoot({ children, data }: { children: React.ReactNode; data: data }) {
  return (
    <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(150px,1fr))]">
      {React.Children.map(children, (child) => {
        if (React.isValidElement(child)) {
          return React.cloneElement(child as ReactElement<any>, { data });
        }
        return child;
      })}
    </div>
  );
}

function SummaryCard({ label, sublabel, icon, find, variant = "none", data, counts }: CardProps) {
  if (!data && !counts) return null;
  let countValue;
  if (counts) {
    countValue = counts;
  } else if (find) {
    countValue = data?.filter((row) => row[find.column] === find.value).length;
  }
  if (!countValue) return null;

  return (
    <div
      className={`
        ${variants[variant]} 
        p-6 border-l-2 border bg-card rounded-none
        flex-1 flex flex-col justify-between gap-4
      `}
    >
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] font-bold tracking-widest text-muted-foreground uppercase opacity-80">
            {label || find?.column}
          </span>
          {icon && <div className="text-muted-foreground opacity-50">{icon}</div>}
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <span className="font-display text-5xl font-bold tracking-tighter text-foreground antialiased italic">
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

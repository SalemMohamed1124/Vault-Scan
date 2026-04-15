"use client";

import type { Report } from "@/types";
import { MobileCard } from "@/components/layout/MobileCard";
import { SeverityBadge } from "@/components/layout/SeverityBadge";
import {
  FileJson,
  Globe,
  File,
  Clock,
  Calendar,
} from "lucide-react";
import { cn, formatDateTime, formatRelativeTime } from "@/lib/utils";
import ReportRowActions from "./ReportRowActions";

const FORMAT_META: Record<string, any> = {
  PDF: { icon: File, theme: "HIGH" },
  JSON: { icon: FileJson, theme: "MEDIUM" },
  HTML: { icon: Globe, theme: "LOW" },
};

export default function ReportMobileCard({ report }: { report: Report }) {
  const meta = FORMAT_META[report.format] ?? FORMAT_META.PDF;
  const Icon = meta.icon;
  const isExpired = new Date(report.expiresAt) < new Date();

  return (
    <MobileCard className="w-full max-w-full">
      <MobileCard.Content>
        <MobileCard.Row>
          <span className="text-xs text-muted-foreground font-medium shrink-0">
            Asset:
          </span>
          <span className="text-xs font-bold truncate text-right">
            {report.scan?.asset?.name || "Unknown Asset"}
          </span>
        </MobileCard.Row>

        <MobileCard.Row>
          <span className="text-xs text-muted-foreground font-medium shrink-0">
            Format:
          </span>
          <SeverityBadge
            theme={meta.theme}
            className="text-[10px] font-bold uppercase py-0 px-2 h-5 rounded-sm"
          >
            {report.format}
          </SeverityBadge>
        </MobileCard.Row>

        <MobileCard.Row>
          <span className="text-xs text-muted-foreground font-medium shrink-0">
            Generated:
          </span>
          <div className="flex items-center gap-1.5 min-w-0">
            <Clock className="size-3.5 text-muted-foreground/60 shrink-0" />
            <span className="text-xs font-bold truncate">
              {formatRelativeTime(report.createdAt)}
            </span>
          </div>
        </MobileCard.Row>

        <MobileCard.Row>
          <span className="text-xs text-muted-foreground font-medium shrink-0">
            Status:
          </span>
          <SeverityBadge
            theme={isExpired ? "critical" : "none"}
            className={cn(
              "text-[10px] font-bold uppercase py-0 px-2 h-5",
              !isExpired &&
                "bg-muted/30 text-muted-foreground border-border/10",
            )}
          >
            {isExpired ? "EXPIRED" : "VALID"}
          </SeverityBadge>
        </MobileCard.Row>

        <MobileCard.Row>
          <span className="text-xs text-muted-foreground font-medium shrink-0">
            Expiry:
          </span>
          <div className="flex items-center gap-1.5 min-w-0">
            <Calendar className="size-3.5 text-muted-foreground/60 shrink-0" />
            <span className="text-xs font-bold truncate">
              {formatDateTime(report.expiresAt).split(",")[0]}
            </span>
          </div>
        </MobileCard.Row>
      </MobileCard.Content>

      <MobileCard.Footer>
        <ReportRowActions report={report} />
      </MobileCard.Footer>
    </MobileCard>
  );
}



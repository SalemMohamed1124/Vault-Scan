"use client";

import type { Notification } from "@/types";
import { cn } from "@/lib/utils";
import { 
  CheckCircle, XCircle, Sparkles, AlertTriangle, Bell, 
  Check
} from "lucide-react";
import { useNotification } from "./useNotification";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { format } from "date-fns";

const TYPE_CONFIG: Record<string, any> = {
  SCAN_COMPLETE: { icon: CheckCircle, color: "text-emerald-500", bg: "bg-emerald-500/10", label: "Scan Complete" },
  SCAN_FAILED: { icon: XCircle, color: "text-red-500", bg: "bg-red-500/10", label: "Scan Failed" },
  AI_ANALYSIS_READY: { icon: Sparkles, color: "text-primary", bg: "bg-primary/10", label: "AI Analysis Ready" },
  CRITICAL_VULN: { icon: AlertTriangle, color: "text-red-500", bg: "bg-red-500/10", label: "Critical Vulnerability" },
};

export default function NotificationCard({ notification }: { notification: Notification }) {
  const { markReadApi, isMarkReadPending } = useNotification();
  const isUnread = !notification.isRead;
  const config = TYPE_CONFIG[notification.type] || { icon: Bell, color: "text-muted-foreground", bg: "bg-muted/30" };
  const Icon = config.icon;

  const cardStyles = cn(
    "group flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-3.5 border transition-all cursor-pointer",
    isUnread ? "bg-primary/2 border-primary/20 shadow-sm" : "bg-card border-border/50 hover:bg-muted/30"
  );

  const buttonStyles = "h-8 text-xs font-bold gap-2 text-primary hover:text-primary hover:bg-primary/10 transition-all";

  return (
    <div className={cardStyles}>
      <div className="flex items-start gap-3.5 min-w-0 flex-1 px-1">
        <div className={cn("mt-0.5 p-1.5 shrink-0", config.bg)}>
          <Icon className={cn("size-4", config.color)} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-0.5">
            <h4 className="text-sm font-bold text-foreground">
              {config.label || notification.type.replace(/_/g, " ")}
            </h4>
            {isUnread && (
              <span className="size-2 bg-primary" />
            )}
          </div>
          <p className="text-sm text-muted-foreground whitespace-normal wrap-break-word mb-1">
            {notification.message}
          </p>
          <time className="text-[11px] text-muted-foreground/50 font-medium">
            {format(new Date(notification.createdAt), "MMM d, HH:mm")}
          </time>
        </div>
      </div>

      <div className="shrink-0">
        {isUnread && (
          <Button
            variant="ghost"
            size="sm"
            className={buttonStyles}
            onClick={(e) => {
              e.stopPropagation();
              markReadApi(notification.id);
            }}
            disabled={isMarkReadPending}
          >
            {isMarkReadPending ? <Spinner className="size-3" /> : <Check className="size-3" />}
            Confirm Read
          </Button>
        )}
      </div>
    </div>
  );
}

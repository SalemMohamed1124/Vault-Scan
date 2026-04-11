import type { Notification } from "@/Types/data-types";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { AlertTriangle, CheckCircle2, Info, AlertCircle, Check } from "lucide-react";
import { useNotification } from "./useNotification";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
const TYPE_CONFIG = {
  success: { icon: CheckCircle2, color: "text-green-600 dark:text-green-500", bg: "bg-green-100/30 dark:bg-green-900/20" },
  error: { icon: AlertCircle, color: "text-red-600 dark:text-red-500", bg: "bg-red-100/30 dark:bg-red-900/20" },
  warning: { icon: AlertTriangle, color: "text-amber-600 dark:text-amber-500", bg: "bg-amber-100/30 dark:bg-amber-900/20" },
  info: { icon: Info, color: "text-blue-600 dark:text-blue-500", bg: "bg-blue-100/30 dark:bg-blue-900/20" },
};

function NotificationCard({ notification }: { notification: Notification }) {
  const config = TYPE_CONFIG[notification.type] || TYPE_CONFIG.info;
  const Icon = config.icon;
  const isUnread = !notification.read;
  const { markAsReadApi, isMarkAsReadPending } = useNotification();
  return (
    <div
      className={cn("flex flex-col sm:flex-row gap-4 p-4 border rounded-xl transition-all cursor-pointer bg-card border-border")}
    >
      <div className="flex items-start gap-4 grow min-w-0">
        <div className={cn("p-2 rounded-full shrink-0", config.bg)}>
          <Icon className={cn("size-5", config.color)} />
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="text-[15px] font-semibold tracking-tight text-foreground truncate">{notification.title}</h4>
            {isUnread && <div className="size-1.5 rounded-full bg-primary shrink-0" />}
          </div>
          <p className="text-sm text-muted-foreground font-medium mb-2 whitespace-normal">{notification.message}</p>
          <time className="text-xs text-muted-foreground/60">{format(notification.createdAt, "PPPP p")}</time>
        </div>
      </div>

      {isUnread && (
        <div className="flex flex-col items-end justify-center pt-3 border-t border-border/50 sm:border-none sm:pt-0 ">
          <Button
            variant="outline"
            className="gap-2 font-medium w-full"
            onClick={(e) => {
              e.stopPropagation();
              markAsReadApi(notification.id);
            }}
            disabled={isMarkAsReadPending}
          >
            {isMarkAsReadPending ? <Spinner /> : <Check />}
            <span>Mark as read</span>
          </Button>
        </div>
      )}
    </div>
  );
}

export default NotificationCard;

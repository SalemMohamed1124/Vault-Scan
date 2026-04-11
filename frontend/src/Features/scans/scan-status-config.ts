import { CheckCircle2, Loader2, XCircle, Clock, Ban } from "lucide-react";
import type { ScanStatus } from "@/types";

export const SCAN_STATUS_CONFIG = {
  COMPLETED: { icon: CheckCircle2, label: "Completed", theme: "none" as const },
  RUNNING: { icon: Loader2, label: "Running", theme: "informative" as const },
  FAILED: { icon: XCircle, label: "Failed", theme: "critical" as const },
  PENDING: {
    icon: Clock,
    label: "Pending",
    theme: "outlineSecondary" as const,
  },
  CANCELLED: { icon: Ban, label: "Cancelled", theme: "medium" as const },
} as const;

export type ScanStatusKey = keyof typeof SCAN_STATUS_CONFIG;

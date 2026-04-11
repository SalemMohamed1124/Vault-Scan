import type { Scan } from "@/Types/data-types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/Customized/card";
import { Badge } from "@/components/Customized/badge";
import { format, parseISO } from "date-fns";
import { Clock, CheckCircle, Zap, Globe, Hash, ShieldAlert, Timer, Activity } from "lucide-react";
import { Separator } from "@/components/ui/separator";

export default function ScanInformation({ scan }: { scan: Scan }) {
  const status = scan.status;
  const statusVariant =
    status == "completed" ? "none" : status == "failed" ? "critical" : status == "running" ? "low" : "outlineSecondary";

  return (
    <Card className="w-full ">
      <CardHeader className="flex flex-col">
        <CardTitle className="text-xl font-bold tracking-tight">Scan Information</CardTitle>
      </CardHeader>

      <CardContent className="space-y-8">
        <div className="flex flex-wrap gap-x-12 gap-y-6">
          <DetailMetric
            icon={<Globe className="size-4 text-primary" />}
            label="Asset"
            value={scan.asset.value}
            className="truncate"
          />

          <DetailMetric
            icon={<Hash className="size-4 text-muted-foreground" />}
            label="Scan Type"
            value={scan.scanType}
            className="capitalize"
          />

          <DetailMetric
            icon={<ShieldAlert className="size-4 text-muted-foreground" />}
            label="Vulnerabilities"
            value={
              <Badge theme={scan.severity} className="px-2 py-0 h-5 text-xs">
                {scan.vulnerabilitiesFound} Found
              </Badge>
            }
          />

          <DetailMetric icon={<Timer className="size-4 text-muted-foreground" />} label="Duration" value={scan.duration} />

          <DetailMetric
            icon={<Activity className="size-4 text-muted-foreground" />}
            label="Status"
            value={
              <Badge
                theme={statusVariant}
                className={`capitalize px-2 py-0 h-5 text-xs ${statusVariant === "none" ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : ""}`}
              >
                {scan.status}
              </Badge>
            }
          />
        </div>

        <Separator />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-6 gap-x-12 text-sm text-muted-foreground">
          <div className="flex flex-col gap-1.5 min-w-0">
            <div className="flex items-center gap-2">
              <Clock className="size-4 text-blue-400/80" />
              <span className="font-bold uppercase text-xs tracking-widest">Started</span>
            </div>
            <p className="font-medium text-foreground truncate pl-6 text-sm">{format(parseISO(scan.startTime), "PPP p")}</p>
          </div>

          <div className="flex flex-col gap-1.5 min-w-0">
            <div className="flex items-center gap-2">
              <CheckCircle className="size-4 text-emerald-500/80" />
              <span className="font-bold uppercase text-xs tracking-widest">Completed</span>
            </div>
            <p className="font-medium text-foreground truncate pl-6 text-sm">{format(parseISO(scan.endTime), "PPP p")}</p>
          </div>

          <div className="flex flex-col gap-1.5 min-w-0 sm:col-span-2 lg:col-span-1">
            <div className="flex items-center gap-2">
              <Zap className="size-4 text-amber-400/80" />
              <span className="font-bold uppercase text-xs tracking-widest">Mechanism</span>
            </div>
            <div className="pl-6">
              <Badge
                theme={scan.triggerType === "manual" ? "informative" : "outlineSecondary"}
                className="capitalize px-2 py-0 h-5 text-xs"
              >
                {scan.triggerType} Scan
              </Badge>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function DetailMetric({
  label,
  value,
  icon,
  className = "",
}: {
  label: string;
  value: string | number | React.ReactNode;
  icon: React.ReactNode;
  className?: string;
}) {
  return (
    <div className="flex flex-col gap-2 min-w-max">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-xs font-bold uppercase tracking-widest">{label}</span>
      </div>
      <div className={`${className} font-semibold text-foreground/90 pl-6 text-sm`}>{value}</div>
    </div>
  );
}

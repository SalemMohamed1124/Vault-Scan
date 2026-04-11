"use client";

import { useRecentScans } from "./useDashboardData";
import { Radar, ArrowRight, Play } from "lucide-react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { useRouter } from "next/navigation";
import { SCAN_STATUS_CONFIG } from "@/Features/scans/scan-status-config";
import { SeverityBadge } from "@/components/layout/SeverityBadge";
import { formatRelativeTime } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

export default function RecentScansTable() {
  const router = useRouter();
  const { data: scans, isLoading } = useRecentScans();

  return (
    <Card className="glass-card shadow-none overflow-hidden h-full flex flex-col">
      <div className="px-5 py-4 border-b border-border/40 bg-muted/10 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="size-8 bg-blue-500/10 flex items-center justify-center text-blue-500 border border-blue-500/10">
            <Radar className="size-4" />
          </div>
          <div className="flex flex-col">
            <h3 className="text-sm font-black uppercase tracking-tight">
              Recent Scans
            </h3>
          </div>
        </div>
        <Link
          href="/scans"
          className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-1 group"
        >
          All Scans <ArrowRight className="size-3" />
        </Link>
      </div>

      <div className="flex-1 overflow-auto">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-border/10">
              <TableHead className="text-[10px] uppercase font-black tracking-widest h-10 px-6">Asset</TableHead>
              <TableHead className="text-[10px] uppercase font-black tracking-widest h-10">Status</TableHead>
              <TableHead className="text-[10px] uppercase font-black tracking-widest h-10 hidden sm:table-cell">Findings</TableHead>
              <TableHead className="text-[10px] uppercase font-black tracking-widest h-10 text-right px-6 hidden md:table-cell">Started</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i} className="border-border/10">
                  <TableCell colSpan={4} className="p-4">
                    <Skeleton className="h-6 w-full opacity-20" />
                  </TableCell>
                </TableRow>
              ))
            ) : scans && scans.length > 0 ? (
              scans.map((scan) => {
                const config = SCAN_STATUS_CONFIG[scan.status];
                return (
                  <TableRow 
                    key={scan.id} 
                    className="border-border/5 border-none! hover:bg-muted/30 cursor-pointer transition-colors group"
                    onClick={() => router.push(`/scans/${scan.id}`)}
                  >
                    <TableCell className="px-6 py-3">
                      <div className="flex items-center gap-3">
                        <Play className="size-3 text-muted-foreground opacity-30 group-hover:opacity-100 group-hover:text-primary transition-all shrink-0" />
                        <div className="flex flex-col min-w-0">
                          <span className="text-[11px] font-bold text-foreground truncate max-w-[150px]">
                            {scan.asset?.name || scan.assetId.slice(0, 8)}
                          </span>
                          <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground opacity-40">
                            {scan.type}
                          </span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="py-3">
                      <SeverityBadge
                        theme={config.theme === "outlineSecondary" ? "none" : config.theme}
                        className="text-[9px] font-black uppercase tracking-tighter h-5 px-2"
                      >
                        {scan.status}
                      </SeverityBadge>
                    </TableCell>
                    <TableCell className="py-3 hidden sm:table-cell">
                      <div className="flex items-center gap-1">
                        <div className="size-1.5 bg-red-500" />
                        <span className="text-[11px] font-black text-foreground">
                          {scan.findingsSummary?.critical || 0}
                        </span>
                        <div className="size-1.5 bg-amber-500 ml-2" />
                        <span className="text-[11px] font-black text-foreground">
                          {scan.findingsSummary?.high || 0}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right px-6 py-3 hidden md:table-cell">
                      <span className="text-[10px] font-bold text-muted-foreground italic">
                        {formatRelativeTime(scan.startedAt)}
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={4} className="h-32 text-center text-[10px] font-black uppercase tracking-widest opacity-30">
                  No Scans Recorded
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}



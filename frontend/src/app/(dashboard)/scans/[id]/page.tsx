"use client";

import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";

import { ScanResultSkeletons } from "@/Features/scans/Scan/ScanResultSkeletons";
import ScanResultsView from "@/Features/scans/Scan/ScanResultsView";
import { useScanResults } from "@/Features/scans/Scan/useScanResults";
import { Suspense } from "react";

export default function ScanDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { scan, findings, loading, actions } = useScanResults(id);

  // ─── Loading State ──────────────────────────────────
  if (loading.scan) return <ScanResultSkeletons />;

  // ─── Not Found State ────────────────────────────────
  if (!scan) {
    return (
      <div className="flex flex-col items-center gap-4 py-20 animate-in fade-in zoom-in-95 duration-300">
        <div className="h-20 w-20 rounded-3xl bg-muted/20 border border-border flex items-center justify-center">
          <Shield className="h-10 w-10 text-muted-foreground/30" />
        </div>
        <div className="text-center space-y-1">
          <h3 className="text-lg font-bold text-foreground">Scan Not Found</h3>
          <p className="text-xs text-muted-foreground">The requested scan ID does not exist or has been removed.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => router.push("/scans")} className="mt-4 rounded-xl px-6">
          <ArrowLeft className="size-4 mr-2" />
          Back to list
        </Button>
      </div>
    );
  }

  return (
    <Suspense fallback={<ScanResultSkeletons />}>
      <ScanResultsView 
        scan={scan} 
        findings={findings} 
        isFindingsPending={loading.findings} 
      actions={actions}
    />
    </Suspense>
  );
}

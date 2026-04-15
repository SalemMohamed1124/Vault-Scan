"use client";

import { useState } from "react";
import { useCancelScan } from "@/Features/scans/useScanMutations";
import { XCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CancelScanButtonProps {
  scanId: string;
  onCancelled?: () => void;
}

export function CancelScanButton({ scanId, onCancelled }: CancelScanButtonProps) {
  const [confirming, setConfirming] = useState(false);

  const cancel = useCancelScan(scanId);

  const handleCancel = async () => {
    await cancel.mutateAsync();
    onCancelled?.();
  };

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Are you sure?</span>
        <Button
          variant="destructive"
          size="sm"
          onClick={() => cancel.mutate()}
          disabled={cancel.isPending}
        >
          {cancel.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            "Yes, cancel"
          )}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
          No
        </Button>
      </div>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => setConfirming(true)}
      className="border-red-500/30 text-red-400 hover:bg-red-500/10"
    >
      <XCircle className="mr-1.5 h-3.5 w-3.5" />
      Cancel Scan
    </Button>
  );
}

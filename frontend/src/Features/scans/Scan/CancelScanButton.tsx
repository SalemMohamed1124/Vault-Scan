"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { XCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import api from "@/lib/api";

interface CancelScanButtonProps {
  scanId: string;
  onCancelled?: () => void;
}

export function CancelScanButton({ scanId, onCancelled }: CancelScanButtonProps) {
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState(false);

  const cancel = useMutation({
    mutationFn: () => api.delete(`/api/scans/${scanId}/cancel`),
    onSuccess: () => {
      toast.success("Scan cancelled");
      queryClient.invalidateQueries({ queryKey: ["scan", scanId] });
      queryClient.invalidateQueries({ queryKey: ["scans"] });
      onCancelled?.();
    },
    onError: () => {
      toast.error("Failed to cancel scan");
    },
  });

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

"use client";

import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/Contexts/ConfirmModalContext";
import { useDeleteManyFindings } from "./useFindingMutations";

interface FindingTableActionsProps {
  selectedIds?: string[];
  onComplete?: () => void;
}

export function FindingTableActions({
  selectedIds = [],
  onComplete,
}: FindingTableActionsProps) {
  const deleteMany = useDeleteManyFindings();
  const { confirm } = useConfirm();

  const handleBulkDelete = () => {
    confirm({
      title: `Delete ${selectedIds.length} Findings`,
      description:
        "This will permanently remove selected security reports. Continue?",
      variant: "danger",
      onConfirm: () => {
        deleteMany.mutate(selectedIds, {
          onSuccess: () => {
            onComplete?.();
          },
        });
      },
    });
  };

  if (selectedIds.length === 0) return null;

  return (
    <Button
      variant="destructive"
      size="sm"
      onClick={handleBulkDelete}
      className="h-9"
    >
      <Trash2 className="size-3.5" />
      Delete ({selectedIds.length})
    </Button>
  );
}

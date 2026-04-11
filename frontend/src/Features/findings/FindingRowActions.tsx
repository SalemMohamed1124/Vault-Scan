import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Eye, ExternalLink, Trash2 } from "lucide-react";
import { useDeleteFindings } from "./useFindings";
import { useConfirm } from "@/Contexts/ConfirmModalContext";
import { useSidebar } from "@/components/ui/sidebar";
import { useRouter } from "next/navigation";
import { useViewModal } from "@/Contexts/ViewModalContext";
import FindingDetailView from "./FindingDetailView";
import type { ScanFinding } from "@/types";

export default function FindingRowActions({ finding }: { finding: ScanFinding }) {
  const { deleteOne } = useDeleteFindings();
  const { confirm } = useConfirm();
  const { view } = useViewModal();
  const { isMobile } = useSidebar();
  const router = useRouter();

  const handleDelete = () => {
    confirm({
      title: "Confirm Deletion",
      description: "Are you sure you want to remove this security finding? This action cannot be undone.",
      confirmText: "Delete",
      variant: "danger",
      onConfirm: () => deleteOne.mutate(finding.id),
    });
  };

  const handleView = () => {
    view({
        title: "Finding Analysis",
        content: <FindingDetailView finding={finding} />
    });
  };

  const handleGoToScan = () => {
    router.push(`/scans/${finding.scanId}`);
  };

  if (isMobile)
    return (
      <div className="flex gap-2 w-full flex-wrap *:flex-1">
        <Button variant="outline" onClick={handleView}>
          <Eye /> View
        </Button>
        <Button variant="outline" onClick={handleGoToScan}>
          <ExternalLink /> Scan
        </Button>
        <Button variant="destructive" onClick={handleDelete}>
          <Trash2 /> Delete
        </Button>
      </div>
    );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-8 w-8 p-0">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Actions</DropdownMenuLabel>
        <DropdownMenuItem onClick={handleView}>
          <Eye className="mr-2 h-4 w-4" />
          View Details
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleGoToScan}>
          <ExternalLink className="mr-2 h-4 w-4" />
          View Original Scan
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={handleDelete}
          className="text-destructive focus:text-destructive"
          disabled={deleteOne.isPending}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Delete Finding
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

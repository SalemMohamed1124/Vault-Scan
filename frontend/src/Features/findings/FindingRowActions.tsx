import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Eye, ExternalLink, Trash2, Wand2 } from "lucide-react";
import { useDeleteFindings } from "./useFindings";
import { useConfirm } from "@/Contexts/ConfirmModalContext";
import { useSidebar } from "@/components/ui/sidebar";
import { useRouter } from "next/navigation";
import { useViewModal } from "@/Contexts/ViewModalContext";
import FindingDetailView from "./FindingDetailView";
import { AIRemediationView } from "@/Features/ai/AIRemediationModal";
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

  const handleAiFix = () => {
    view({
      content: (
        <AIRemediationView
          findingId={finding.id}
          findingName={finding.vulnerability?.name || "Unknown Vulnerability"}
          severity={finding.vulnerability?.severity || "LOW"}
        />
      ),
      noPadding: true,
      hideCloseButton: true,
      maxWidth: "sm:max-w-2xl",
    });
  };

  const handleGoToScan = () => {
    router.push(`/scans/${finding.scanId}`);
  };

  if (isMobile) {
    return (
      <div className="grid grid-cols-2 gap-2 w-full">
        <Button variant="outline" onClick={handleView} className="w-full text-xs h-9 gap-2">
          <Eye className="size-3.5" /> View Results
        </Button>
        <Button onClick={handleAiFix} className="w-full text-xs h-9 gap-2 bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20">
          <Wand2 className="size-3.5" /> AI Fix
        </Button>
        <Button variant="outline" onClick={handleGoToScan} className="w-full text-xs h-9 gap-2 col-span-2">
          <ExternalLink className="size-3.5" /> Open Scan
        </Button>
        <Button variant="destructive" onClick={handleDelete} className="w-full text-xs h-9 gap-2 col-span-2">
          <Trash2 className="size-3.5" /> Remove Finding
        </Button>
      </div>
    );
  }

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
        <DropdownMenuItem onClick={handleAiFix} className="text-primary font-medium focus:text-primary focus:bg-primary/10">
          <Wand2 className="mr-2 h-4 w-4" />
          AI Fix Guide
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

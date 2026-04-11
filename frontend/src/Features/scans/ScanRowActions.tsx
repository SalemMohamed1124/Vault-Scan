"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Eye, Trash, FileText } from "lucide-react";
import type { Scan } from "@/types";
import { useSidebar } from "@/components/ui/sidebar";
import { useConfirm } from "@/Contexts/ConfirmModalContext";
import { useViewModal } from "@/Contexts/ViewModalContext";
import { useRouter } from "next/navigation";
import useScan from "./useScan";
import ScanDetailView from "./ScanDetailView";
import { Spinner } from "@/components/ui/spinner";

interface ScanRowActionsProps {
  scan: Scan;
}

export default function ScanRowActions({ scan }: ScanRowActionsProps) {
  const { isMobile } = useSidebar();
  const { confirm } = useConfirm();
  const { view } = useViewModal();
  const { deleteScanApi, isDeleting } = useScan();
  const router = useRouter();

  const handleShowDetails = () => {
    view({
      title: "Scan Details",
      content: <ScanDetailView scan={scan} />,
      maxHeight: "max-h-[600px]",
      maxWidth: "sm:max-w-xl",
    });
  };

  const handleShowResults = () => {
    router.push(`/scans/${scan.id}`);
  };

  const handleDelete = () => {
    confirm({
      title: "Delete Scan",
      description: "Are you sure you want to delete this scan? This action cannot be undone.",
      variant: "danger",
      confirmText: "Delete",
      onConfirm: async () => {
        await deleteScanApi(scan.id);
      },
    });
  };

  if (isMobile) {
    return (
      <div className="grid grid-cols-2 gap-2 w-full">
        <Button variant="outline" onClick={handleShowDetails} className="text-xs w-full">
          <Eye className="size-3.5" />
          Show Details
        </Button>
        <Button variant="outline" onClick={handleShowResults} className="text-xs w-full">
          <FileText className="size-3.5" />
          Results
        </Button>
        <Button 
          variant="destructive" 
          onClick={handleDelete} 
          disabled={isDeleting}
          className="text-xs col-span-2 w-full"
        >
          {isDeleting ? <Spinner className="size-3.5 mr-1" /> : <Trash className="size-3.5 mr-1" />}
          Delete Scan
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
        <DropdownMenuItem onClick={handleShowDetails}>
          <Eye className="mr-2 h-4 w-4" />
          Show Details
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleShowResults}>
          <FileText className="mr-2 h-4 w-4" />
          View Results
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem 
          onClick={handleDelete} 
          disabled={isDeleting}
          className="text-destructive focus:text-destructive"
        >
          {isDeleting ? <Spinner className="mr-2 h-4 w-4" /> : <Trash className="mr-2 h-4 w-4" />}
          Delete Scan
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

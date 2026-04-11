import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Copy, MoreHorizontal, Trash, Eye } from "lucide-react";
import type { Scan } from "@/Types/data-types";

import { useSidebar } from "@/components/ui/sidebar";
import { toClipboard } from "@/lib/utils";
import { useNavigate } from "react-router";
import { useConfirm } from "@/Contexts/ConfirmModalContext";
import useScan from "./useScan";
import { Spinner } from "@/components/ui/spinner";

type ScanActionsProps = {
  scan: Scan;
};

function ScanRowActions({ scan }: ScanActionsProps) {
  const { isMobile } = useSidebar();
  const { confirm } = useConfirm();
  const { deleteScanApi, isDeleting } = useScan();
  const navigate = useNavigate();

  function handleShowDetails() {
    navigate(`/history/${scan.id}`);
  }

  async function handleDelete() {
    confirm({
      title: "Delete Scan",
      description: "Are you sure you want to delete this scan?",
      variant: "danger",
      onConfirm: async () => await deleteScanApi(scan.id),
    });
  }

  if (isMobile) {
    return (
      <div className="flex gap-2 w-full flex-wrap *:flex-1">
        <Button variant={"outline"} size="sm" onClick={handleShowDetails} className="gap-2">
          <Eye />
          Details
        </Button>
        <Button variant={"outline"} size="sm" onClick={() => toClipboard(scan.asset.value, "Asset copied to clipboard")}>
          <Copy />
          Asset
        </Button>
        <Button variant={"destructive"} size="sm" onClick={handleDelete} disabled={isDeleting}>
          <Trash />
          {isDeleting ? <Spinner /> : "Delete"}
        </Button>
      </div>
    );
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost">
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Actions</DropdownMenuLabel>
          <DropdownMenuItem onClick={handleShowDetails} className="gap-2">
            <Eye />
            Details
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => toClipboard(scan.asset.value, "Asset copied to clipboard")}>
            <Copy />
            Copy Asset
          </DropdownMenuItem>

          <DropdownMenuItem onClick={handleDelete} disabled={isDeleting} className="text-destructive focus:text-destructive">
            <Trash />
            {isDeleting ? <Spinner /> : "Delete"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}

export default ScanRowActions;

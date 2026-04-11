import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Eye, Copy, Trash, Pencil } from "lucide-react";

import type { Asset } from "@/types";
import { useSidebar } from "@/components/ui/sidebar";
import { useConfirm } from "@/Contexts/ConfirmModalContext";
import { useViewModal } from "@/Contexts/ViewModalContext";
import AssetDetailView from "@/Features/assets/AssetDetailView";
import useAsset from "@/Features/assets/useAsset";
import { useAssetFormModals } from "@/Features/assets/useAssetFormModals";
import { toast } from "sonner";

const toClipboard = (text: string, message?: string) => {
  navigator.clipboard.writeText(text);
  if (message) toast.success(message);
};

type AssetRowActionsProps = {
  asset: Asset;
};

function AssetRowActions({ asset }: AssetRowActionsProps) {
  const { isMobile } = useSidebar();
  const { confirm } = useConfirm();
  const { view } = useViewModal();
  const { deleteAssetApi: deleteAsset } = useAsset();
  const { openEditAsset } = useAssetFormModals();

  function handleShowMore() {
    view({
      title: "Asset Details",
      content: <AssetDetailView asset={asset} />,
    });
  }

  function handleEdit() {
    openEditAsset(asset);
  }

  const handleDelete = () => {
    confirm({
      title: "Delete Asset",
      description: `Are you sure you want to delete ${asset.name}? This action cannot be undone.`,
      variant: "danger",
      confirmText: "Delete",
      onConfirm: async () => {
        await deleteAsset(asset.id);
      },
    });
  };

  if (isMobile)
    return (
      <div className="grid grid-cols-2 gap-2 w-full">
        <Button variant={"outline"} onClick={handleShowMore} className="w-full text-xs">
          <Eye className="size-3.5" />
          Show More
        </Button>
        <Button variant={"outline"} onClick={handleEdit} className="w-full text-xs">
          <Pencil className="size-3.5" />
          Edit
        </Button>
        <Button variant={"outline"} onClick={() => toClipboard(asset.value, "Asset value copied")} className="w-full text-xs">
          <Copy className="size-3.5" />
          Copy
        </Button>
        <Button variant={"destructive"} onClick={handleDelete} className="w-full text-xs">
          <Trash className="size-3.5" />
          Delete
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
        <DropdownMenuItem onClick={() => toClipboard(asset.value, "Asset value copied to clipboard")}>
          <Copy className="mr-2 h-4 w-4" />
          Copy Value
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleShowMore}>
          <Eye className="mr-2 h-4 w-4" />
          Show Details
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleEdit}>
          <Pencil className="mr-2 h-4 w-4" />
          Edit Asset
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleDelete} className="text-destructive focus:text-destructive">
          <Trash className="mr-2 h-4 w-4" />
          Delete Asset
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default AssetRowActions;

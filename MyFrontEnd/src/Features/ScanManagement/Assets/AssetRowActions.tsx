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

import type { Asset } from "@/Types/data-types";
import { useSidebar } from "@/components/ui/sidebar";
import { toClipboard } from "@/lib/utils";
import { useConfirm } from "@/Contexts/ConfirmModalContext";
import { useViewModal } from "@/Contexts/ViewModalContext";
import AssetDetailView from "./AssetDetailView";
import useAsset from "./useAsset";
import useAssetFormModals from "./useAssetFormModals";

type AssetRowActionsProps = {
  asset: Asset;
};

function AssetRowActions({ asset }: AssetRowActionsProps) {
  const { isMobile } = useSidebar();
  const { confirm } = useConfirm();
  const { view } = useViewModal();
  const { deleteAssetApi } = useAsset();
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
        await deleteAssetApi(asset.id);
      },
    });
  };

  if (isMobile)
    return (
      <div className="flex gap-2 w-full flex-wrap *:flex-1">
        <Button variant={"outline"} onClick={handleShowMore}>
          <Eye />
          Show More
        </Button>
        <Button variant={"outline"} onClick={handleEdit}>
          <Pencil />
          Edit
        </Button>
        {asset.type === "ip" && (
          <Button variant={"outline"} onClick={() => toClipboard(asset.value, "Asset value copied")}>
            <Copy />
            Copy
          </Button>
        )}
        <Button variant={"destructive"} onClick={handleDelete}>
          <Trash />
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
        <DropdownMenuItem onClick={handleShowMore}>
          <Eye className="mr-2 " />
          Show Details
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {asset.type === "ip" && (
          <DropdownMenuItem onClick={() => toClipboard(asset.value, "Asset value copied")}>
            <Copy className="mr-2 " />
            Copy Value
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={handleEdit}>
          <Pencil className="mr-2 " />
          Edit Asset
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleDelete} className="text-destructive focus:text-destructive">
          <Trash className="mr-2 " />
          Delete Asset
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default AssetRowActions;

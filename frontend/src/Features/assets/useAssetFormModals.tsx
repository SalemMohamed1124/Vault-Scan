"use client";

import { useViewModal } from "@/Contexts/ViewModalContext";
import { Button } from "@/components/ui/button";
import { Plus, Upload } from "lucide-react";
import type { Asset } from "@/types";
import AssetForm from "./AssetForm";
import BulkAssetForm from "./BulkAssetForm";

export function useAssetFormModals() {
  const { view } = useViewModal();

  const openCreateModal = () => {
    view({
      title: "Register New Asset",
      content: <AssetForm />,
      noPadding: true,
      defaultScroll: false,
    });
  };

  const openBulkCreateModal = () => {
    view({
      title: "Bulk Register Assets",
      content: <BulkAssetForm />,
      noPadding: true,
      defaultScroll: false,
    });
  };

  const openEditAsset = (asset: Asset) => {
    view({
      title: `Edit Asset: ${asset.name}`,
      content: <AssetForm asset={asset} />,
      noPadding: true,
      defaultScroll: false,
    });
  };

  return {
    openCreateModal,
    openBulkCreateModal,
    openEditAsset,
  };
}

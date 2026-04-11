"use client";

import { useAssets } from "./useAssets";
import { AssetColumns } from "./AssetColumns";
import { DataTable } from "@/components/dataTable/DataTable";
import { useAssetFormModals } from "./useAssetFormModals";
import { Button } from "@/components/ui/button";
import { Plus, Upload } from "lucide-react";

export default function AssetsTable() {
  const { assets, isPending } = useAssets();

  return (
    <DataTable
      tableName="AssetsTable"
      columns={AssetColumns}
      data={assets?.data || []}
      isPending={isPending}
      extraActions={<AssetTableActions />}
    />
  );
}

export function AssetTableActions() {
  const { openCreateModal, openBulkCreateModal } = useAssetFormModals();

  return (
    <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
      <Button
        variant="outline"
        onClick={openBulkCreateModal}
        className="h-9 gap-2 w-full sm:w-auto order-2 sm:order-1"
      >
        <Upload className="size-4" />
        Bulk
      </Button>
      <Button
        variant="primary"
        onClick={openCreateModal}
        className="h-9 gap-2 w-full sm:w-auto order-1 sm:order-2"
      >
        <Plus className="size-4" />
        Add Asset
      </Button>
    </div>
  );
}

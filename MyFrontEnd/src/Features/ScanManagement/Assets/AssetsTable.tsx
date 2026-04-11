import { DataTable } from "@/components/DataTable/DataTable";
import { AssetColumns } from "./AssetColumns";
import useAssets from "./useAssets";
import useAssetFormModals from "./useAssetFormModals";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

function AssetsTable() {
  const { isPending, assets = [], error } = useAssets();
  const { openAddAsset } = useAssetFormModals();

  return (
    <DataTable
      columns={AssetColumns}
      data={assets}
      isLoading={isPending}
      tableName="AssetsTable"
      error={error}
      extraActions={
        <Button onClick={openAddAsset} variant="primary">
          <Plus />
          Add Asset
        </Button>
      }
    />
  );
}
export default AssetsTable;

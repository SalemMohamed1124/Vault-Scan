import { useViewModal } from "@/Contexts/ViewModalContext";
import { AssetForm } from "./AssetForm";
import type { Asset } from "@/Types/data-types";

export default function useAssetFormModals() {
  const { view } = useViewModal();

  const openAddAsset = () => {
    view({
      title: "Add New Asset",
      content: <AssetForm />,
      defaultScroll: false,
    });
  };

  const openEditAsset = (asset: Asset) => {
    view({
      title: "Edit Asset",
      content: <AssetForm asset={asset} />,
      defaultScroll: false,
    });
  };

  return { openAddAsset, openEditAsset };
}

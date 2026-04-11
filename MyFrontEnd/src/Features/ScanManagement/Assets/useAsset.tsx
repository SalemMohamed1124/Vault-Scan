import { addAsset, deleteAsset, fetchAsset, updateAsset } from "@/Services/Assets";
import type { Asset } from "@/Types/data-types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export default function useAsset(id?: string) {
  const queryClient = useQueryClient();

  const {
    isPending,
    data: asset,
    error,
  } = useQuery({
    queryFn: () => fetchAsset(id!),
    queryKey: ["asset", id],
    enabled: !!id,
  });

  const {
    isPending: isDeleting,
    mutateAsync: deleteAssetApi,
    error: deleteError,
  } = useMutation({
    mutationFn: (id: string) => deleteAsset(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["Assets"] });
      toast.success(`Asset #${id} deleted successfully`, {
        position: "top-center",
      });
    },
    onError: (_, id) => {
      toast.error(`Failed to delete asset #${id}`, {
        position: "top-center",
      });
    },
  });

  const {
    isPending: isAdding,
    mutateAsync: addAssetApi,
    error: addingError,
  } = useMutation({
    mutationFn: (newAsset: Omit<Asset, "id" | "addedDate" | "lastScan">) => addAsset(newAsset),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["Assets"] });
      toast.success("Asset added successfully", { position: "top-center" });
    },
    onError: () => {
      toast.error("Failed to add new asset", { position: "top-center" });
    },
  });

  const {
    isPending: isUpdating,
    mutateAsync: updateAssetApi,
    error: updateError,
  } = useMutation({
    mutationFn: ({ id, updatedAsset }: { id: string; updatedAsset: Omit<Asset, "id" | "addedDate" | "lastScan"> }) =>
      updateAsset(id, updatedAsset),
    onSuccess: () => {
      toast.success("Asset updated successfully", {
        position: "top-center",
      });
      queryClient.invalidateQueries({ queryKey: ["Assets"] });
    },
    onError: () => {
      toast.error("Failed to update asset", {
        position: "top-center",
      });
    },
  });
  return {
    isPending,
    error,
    asset,
    isDeleting,
    deleteAssetApi,
    deleteError,
    isAdding,
    addAssetApi,
    addingError,
    isUpdating,
    updateAssetApi,
    updateError,
  };
}

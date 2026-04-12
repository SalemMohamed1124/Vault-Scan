"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Asset } from "@/types";
import { 
  fetchAsset, 
  deleteAsset, 
  createAsset, 
  updateAsset, 
  bulkCreateAssets 
} from "@/Services/Assets";
import type { AxiosError } from "axios";

export default function useAsset(id?: string) {
  const queryClient = useQueryClient();
  const pathname = usePathname();

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
    mutationFn: deleteAsset,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assets"] });
      toast.success(`Asset deleted successfully`, { position: "top-center" });
    },
    onError: () => {
      toast.error(`Failed to delete asset`, { position: "top-center" });
    },
  });

  const {
    isPending: isAdding,
    mutateAsync: addAssetApi,
    error: addingError,
  } = useMutation({
    mutationFn: createAsset,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assets"] });
      const isAssetsPage = pathname === "/assets";
      toast.success("Asset added successfully", { 
        position: "top-center",
        action: !isAssetsPage ? (
          <Link href="/assets" className="text-primary font-bold hover:underline text-xs mr-2 transition-all">
            View assets
          </Link>
        ) : undefined
      });
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
    mutationFn: ({ id, updatedAsset }: { id: string; updatedAsset: Partial<Asset> }) => 
      updateAsset(id, updatedAsset),
    onSuccess: () => {
      toast.success("Asset updated successfully", { position: "top-center" });
      queryClient.invalidateQueries({ queryKey: ["assets"] });
      if (id) queryClient.invalidateQueries({ queryKey: ["asset", id] });
    },
    onError: () => {
      toast.error("Failed to update asset", { position: "top-center" });
    },
  });

  const {
    isPending: isBulkAdding,
    mutateAsync: bulkAddAssetsApi,
    error: bulkAddingError,
  } = useMutation({
    mutationFn: bulkCreateAssets,
    onSuccess: (data: { created: Asset[]; skipped: any[] }) => {
      const { created, skipped } = data;
      const isAssetsPage = pathname === "/assets";
      
      if (created?.length > 0) {
        toast.success(`Registered ${created.length} new assets`, {
          action: !isAssetsPage ? (
            <Link href="/assets" className="text-primary font-bold hover:underline text-xs mr-2 transition-all">
              View assets
            </Link>
          ) : undefined
        });
      }
      if (skipped?.length > 0) {
        toast.warning(`${skipped.length} targets were skipped (already exist)`);
      }
      queryClient.invalidateQueries({ queryKey: ["assets"] });
    },
    onError: (error: AxiosError<{ message: string }>) => {
      toast.error(error.response?.data?.message || "Failed to bulk register assets");
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
    isBulkAdding,
    bulkAddAssetsApi,
    bulkAddingError,
  };
}

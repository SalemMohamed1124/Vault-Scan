"use client";

import { useQuery } from "@tanstack/react-query";
import type { AssetType } from "@/types";
import { fetchAssets, fetchAssetStats, fetchAsset } from "@/Services/Assets";

export function useAssets(params?: {
  search?: string;
  type?: AssetType | "";
  page?: number;
  limit?: number;
}) {
  const {
    isPending,
    data: assets,
    error,
  } = useQuery({
    queryKey: ["assets", params],
    queryFn: () => fetchAssets(params),
  });

  return { isPending, assets, error };
}

export function useAssetsStats() {
  const {
    isPending,
    data: stats,
    error,
  } = useQuery({
    queryKey: ["assets", "stats"],
    queryFn: fetchAssetStats,
  });

  return { isPending, stats, error };
}

export function useAsset(id: string) {
  return useQuery({
    queryKey: ["asset", id],
    queryFn: () => fetchAsset(id),
    enabled: !!id,
  });
}

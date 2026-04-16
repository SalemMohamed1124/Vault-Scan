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
  const query = useQuery({
    queryKey: ["assets", params],
    queryFn: () => fetchAssets(params),
  });

  const items = query.data?.data ?? [];
  const total = query.data?.total ?? 0;
  const isEmpty = !query.isPending && !query.isError && items.length === 0;

  return {
    items,
    total,
    isPending: query.isPending,
    isError: query.isError,
    error: query.error,
    isEmpty,
    refetch: query.refetch,
  };
}

export function useAssetsStats() {
  const query = useQuery({
    queryKey: ["assets", "stats"],
    queryFn: fetchAssetStats,
  });

  return {
    stats: query.data ?? null,
    isPending: query.isPending,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

export function useAsset(id: string) {
  const query = useQuery({
    queryKey: ["asset", id],
    queryFn: () => fetchAsset(id),
    enabled: !!id,
  });

  return {
    item: query.data ?? null,
    isPending: query.isPending,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

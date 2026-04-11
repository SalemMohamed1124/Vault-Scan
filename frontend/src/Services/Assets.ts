import api from "@/lib/api";
import type { Asset, AssetStats, PaginatedResponse, AssetType, BulkCreateAssetItem } from "@/types";

export async function fetchAssets(params?: {
  search?: string;
  type?: AssetType | "";
  page?: number;
  limit?: number;
}) {
  const query = new URLSearchParams();
  if (params?.search) query.set("search", params.search);
  if (params?.type) query.set("type", params.type);
  query.set("page", String(params?.page || 1));
  query.set("limit", String(params?.limit || 10000));

  const { data } = await api.get<PaginatedResponse<Asset>>(
    `/api/assets?${query.toString()}`
  );
  return data;
}

export async function fetchAssetStats() {
  const { data } = await api.get<AssetStats>("/api/assets/stats");
  return data;
}

export async function fetchAsset(id: string) {
  const { data } = await api.get<Asset>(`/api/assets/${id}`);
  return data;
}

export async function createAsset(newAsset: Partial<Asset>) {
  const { data } = await api.post<Asset>("/api/assets", newAsset);
  return data;
}

export async function updateAsset(id: string, updatedAsset: Partial<Asset>) {
  const { data } = await api.patch<Asset>(`/api/assets/${id}`, updatedAsset);
  return data;
}

export async function deleteAsset(id: string) {
  await api.delete(`/api/assets/${id}`);
}

export async function bulkCreateAssets(items: BulkCreateAssetItem[]) {
  const { data } = await api.post("/api/assets/bulk", { items });
  return data;
}

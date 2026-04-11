import { AssetSchema, AssetsSchema, type Asset } from "../Types/data-types";
import { fakeAssets } from "../../public/Assets";

export async function fetchAssets() {
  await new Promise(() => setTimeout(() => console.log("hello"), 200));
  return AssetsSchema.parse(fakeAssets);
}

export async function fetchAsset(id: string) {
  await new Promise((resolve) => {
    setTimeout(resolve, 200);
  });
  return AssetSchema.parse(fakeAssets.find((a) => a.id === id));
}

export async function deleteAsset(id: string) {
  await new Promise((r) => setTimeout(r, 200));
  const index = fakeAssets.findIndex((p) => p.id === id);
  if (index !== -1) fakeAssets.splice(index, 1);
}

export async function addAsset(newAsset: Omit<Asset, "id" | "addedDate" | "lastScan">) {
  await new Promise((r) => setTimeout(r, 2000));
  const asset: Asset = {
    ...newAsset,
    id: Math.random().toString(36).substring(2, 9),
    addedDate: new Date().toISOString(),
    lastScan: null,
  };
  fakeAssets.unshift(asset);
  return asset;
}
export async function updateAsset(id: string, updatedAsset: Omit<Asset, "id" | "addedDate" | "lastScan">) {
  await new Promise((r) => setTimeout(r, 2000));
  const index = fakeAssets.findIndex((p) => p.id === id);
  if (index !== -1) {
    fakeAssets[index] = { ...fakeAssets[index], ...updatedAsset };
    return fakeAssets[index];
  }
  throw new Error("Asset not found");
}

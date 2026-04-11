import { fetchAssets } from "@/Services/Assets";
import type { Asset } from "@/Types/data-types";
import { useQuery } from "@tanstack/react-query";

export default function useAssets() {
  const {
    isPending,
    data: assets,
    error,
  } = useQuery<Asset[], Error>({
    queryKey: ["Assets"],
    queryFn: fetchAssets,
  });

  return { isPending, assets, error };
}

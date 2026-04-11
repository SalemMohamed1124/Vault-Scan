import { fetchScans } from "@/Services/Scans";
import type { Scan } from "@/Types/data-types";
import { useQuery } from "@tanstack/react-query";

function useScans() {
  const {
    data: scans,
    isPending,
    error,
  } = useQuery<Scan[], Error>({
    queryKey: ["scans"],
    queryFn: fetchScans,
  });

  return { scans, isPending, error };
}

export default useScans;

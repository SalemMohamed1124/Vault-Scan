import { fetchVulnerabilities } from "@/Services/Vulnerabilities";
import type { Vulnerability } from "@/Types/data-types";
import { useQuery } from "@tanstack/react-query";

function useVulnerabilities() {
  const {
    data: vulnerabilities,
    isPending,
    error,
  } = useQuery<Vulnerability[], Error>({
    queryKey: ["vulnerabilities"],
    queryFn: fetchVulnerabilities,
  });

  return {
    vulnerabilities,
    isPending,
    error,
  };
}

export default useVulnerabilities;

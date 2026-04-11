import { useQuery } from "@tanstack/react-query";
import { fetchFixedVulnerabilities } from "@/Services/FixedVulnerabilities";
import { type Vulnerability } from "@/Types/data-types";

export default function useFixedVulnerabilities() {
  const {
    isPending,
    data: fixedVulns,
    error,
  } = useQuery<Vulnerability[], Error>({
    queryKey: ["fixedVulnerabilities"],
    queryFn: fetchFixedVulnerabilities,
  });
  return {
    isPending,
    fixedVulns,
    error,
  };
}

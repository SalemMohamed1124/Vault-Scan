import { type Domain } from "@/Types/data-types";
import { fetchDomains } from "../../../Services/Domains";
import { useQuery } from "@tanstack/react-query";

function useDomains() {
  const {
    data: domains,
    isPending,
    error,
  } = useQuery<Domain[], Error>({
    queryKey: ["domains"],
    queryFn: fetchDomains,
  });

  return { domains, isPending, error };
}

export default useDomains;

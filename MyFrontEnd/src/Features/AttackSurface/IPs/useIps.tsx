import { fetchIps } from "@/Services/Ips";
import { type Ip } from "@/Types/data-types";
import { useQuery } from "@tanstack/react-query";

function useIps() {
  const {
    data: ips,
    isPending,
    error,
  } = useQuery<Ip[], Error>({
    queryKey: ["ips"],
    queryFn: fetchIps,
  });

  return { ips, isPending, error };
}

export default useIps;

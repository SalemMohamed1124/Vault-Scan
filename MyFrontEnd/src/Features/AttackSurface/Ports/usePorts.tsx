import { fetchPorts } from "@/Services/Ports";
import { type Port } from "@/Types/data-types";
import { useQuery } from "@tanstack/react-query";

function usePorts() {
  const {
    data: ports,
    isPending,
    error,
  } = useQuery<Port[], Error>({
    queryKey: ["ports"],
    queryFn: fetchPorts,
  });

  return { ports, isPending, error };
}

export default usePorts;

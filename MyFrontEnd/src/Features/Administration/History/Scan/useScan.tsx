import { deleteScan, fetchScan } from "@/Services/Scans";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

function useScan(id?: string) {
  const queryClient = useQueryClient();

  const {
    data: scan,
    isPending,
    error,
  } = useQuery({
    queryKey: ["scan", id],
    queryFn: () => fetchScan(id!),
    enabled: !!id,
  });

  const {
    isPending: isDeleting,
    mutateAsync: deleteScanApi,
    error: deleteError,
  } = useMutation({
    mutationFn: (id: string) => deleteScan(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["scans"] });
      toast.success(`Scan ${id} deleted successfully`);
    },
    onError: (_, id) => {
      toast.error(`Failed to delete scan ${id}`);
    },
  });

  return {
    scan,
    isPending,
    error,
    deleteScanApi,
    isDeleting,
    deleteError,
  };
}

export default useScan;

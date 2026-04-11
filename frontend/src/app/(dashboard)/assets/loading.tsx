import { TableLoading, SummaryLoading } from "@/components/layout/TableLoading";
import { Skeleton } from "@/components/ui/skeleton";

export default function AssetsLoading() {
  return (
    <div className="w-full space-y-4">
      <div>
        <Skeleton className="h-8 w-48 mb-2" />
        <Skeleton className="h-4 w-96 opacity-60" />
      </div>
      <SummaryLoading cards={4} />
      <TableLoading rows={6} />
    </div>
  );
}

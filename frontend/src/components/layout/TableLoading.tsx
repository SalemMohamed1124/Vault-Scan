import { Skeleton } from "@/components/ui/skeleton";

export function TableLoading({ rows = 5 }: { rows?: number }) {
  return (
    <div className="w-full space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-10 w-32" />
      </div>
      <div className="border">
        <div className="p-4 space-y-4">
          {[...Array(rows)].map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="h-12 w-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function SummaryLoading({ cards = 4 }: { cards?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
      {[...Array(cards)].map((_, i) => (
        <Skeleton key={i} className="h-28" />
      ))}
    </div>
  );
}

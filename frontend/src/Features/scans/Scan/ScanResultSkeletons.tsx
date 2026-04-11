import { Skeleton } from "@/components/ui/skeleton";

export function ScanResultSkeletons() {
  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Back button skeleton */}
      <Skeleton className="h-8 w-32" />
      
      {/* Hero skeleton */}
      <div className="glass-card p-6 space-y-4">
        <div className="flex items-center gap-4">
          <Skeleton className="h-12 w-12" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-6 w-64" />
            <Skeleton className="h-4 w-96" />
          </div>
        </div>
        <Skeleton className="h-3 w-full" />
      </div>

      {/* Severity cards skeleton */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>

      {/* Tabs skeleton */}
      <div className="flex gap-4 border-b border-border pb-px">
        <Skeleton className="h-10 w-24" />
        <Skeleton className="h-10 w-24" />
        <Skeleton className="h-10 w-24" />
      </div>

      {/* Content skeleton */}
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    </div>
  );
}

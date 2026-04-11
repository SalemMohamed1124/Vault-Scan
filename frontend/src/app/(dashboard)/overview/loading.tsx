import { Skeleton } from "@/components/ui/skeleton";

export default function OverviewLoading() {
  return (
    <div className="flex flex-col gap-8 pb-10 animate-pulse">
      {/* Header Section Skeleton */}
      <section className="flex flex-col gap-1">
        <div className="flex items-center gap-2 mb-1">
          <Skeleton className="h-8 w-8" />
          <Skeleton className="h-8 w-64" />
        </div>
        <Skeleton className="h-4 w-96 ml-10" />
      </section>

      {/* Stats Section Skeleton */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-5">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>

      {/* AI Insights Skeleton */}
      <Skeleton className="h-48 w-full" />

      {/* Charts Row Skeleton */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Skeleton className="h-[350px]" />
        <Skeleton className="h-[350px]" />
      </div>

      {/* Intelligence Row Skeleton */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Skeleton className="h-[400px]" />
        <Skeleton className="h-[400px]" />
        <Skeleton className="h-[400px]" />
      </div>
    </div>
  );
}

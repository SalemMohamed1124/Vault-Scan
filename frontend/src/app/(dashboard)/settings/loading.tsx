import { Skeleton } from "@/components/ui/skeleton";

export default function SettingsLoading() {
  return (
    <div className="w-full space-y-4">
      <div>
        <Skeleton className="h-8 w-48 mb-2" />
        <Skeleton className="h-4 w-96 opacity-60" />
      </div>

      <div className="flex gap-2 mb-6">
        <Skeleton className="h-10 w-24" />
        <Skeleton className="h-10 w-24" />
        <Skeleton className="h-10 w-24" />
      </div>

      <div className="border p-6 space-y-6">
        <div>
          <Skeleton className="h-8 w-64 mb-2" />
          <Skeleton className="h-4 w-96 opacity-60" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-12 w-full max-w-md" />
          <Skeleton className="h-12 w-full max-w-md" />
          <Skeleton className="h-12 w-full max-w-md" />
        </div>
      </div>
    </div>
  );
}

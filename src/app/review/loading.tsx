import { Skeleton } from '@/components/ui/Skeleton';

export default function ReviewQueueLoading() {
  return (
    <div className="page-with-nav max-w-3xl mx-auto px-6 py-8">
      <Skeleton className="h-6 w-40 mb-2" />
      <Skeleton className="h-4 w-64 mb-8" />
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    </div>
  );
}

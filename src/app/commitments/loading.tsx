import { Skeleton } from '@/components/ui/Skeleton';

export default function CommitmentsLoading() {
  return (
    <div className="page-with-nav max-w-3xl mx-auto px-6 py-8">
      <Skeleton className="h-6 w-44 mb-2" />
      <Skeleton className="h-4 w-72 mb-8" />
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    </div>
  );
}

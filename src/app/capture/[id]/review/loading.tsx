import { Skeleton } from '@/components/ui/Skeleton';

export default function ReviewLoading() {
  return (
    <div className="page-with-nav max-w-2xl mx-auto px-4 py-8">
      <Skeleton className="h-6 w-56 mb-2" />
      <Skeleton className="h-4 w-80 mb-6" />
      <Skeleton className="h-32 w-full mb-4" />
      <div className="flex gap-3">
        <Skeleton className="h-9 w-24" />
        <Skeleton className="h-9 w-20" />
      </div>
    </div>
  );
}

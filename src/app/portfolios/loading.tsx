import { Skeleton } from '@/components/ui/Skeleton';

export default function PortfoliosLoading() {
  return (
    <div className="page-with-nav max-w-4xl mx-auto px-6 py-8">
      <Skeleton className="h-6 w-36 mb-2" />
      <Skeleton className="h-4 w-64 mb-8" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    </div>
  );
}

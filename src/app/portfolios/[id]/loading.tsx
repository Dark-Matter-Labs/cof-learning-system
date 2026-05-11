import { Skeleton } from '@/components/ui/Skeleton';

export default function PortfolioDetailLoading() {
  return (
    <div className="page-with-nav max-w-4xl mx-auto px-6 py-8">
      <Skeleton className="h-5 w-24 mb-6" />
      <Skeleton className="h-7 w-72 mb-2" />
      <Skeleton className="h-4 w-96 mb-8" />
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    </div>
  );
}

import { Skeleton } from '@/components/ui/Skeleton';

export default function NewsletterLoading() {
  return (
    <div className="page-with-nav max-w-3xl mx-auto px-6 py-8">
      <Skeleton className="h-6 w-48 mb-2" />
      <Skeleton className="h-4 w-80 mb-8" />
      <div className="flex gap-4 mb-6 border-b border-cof-border pb-3">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-5 w-28" />
      </div>
      <Skeleton className="h-9 w-48 mb-6" />
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    </div>
  );
}

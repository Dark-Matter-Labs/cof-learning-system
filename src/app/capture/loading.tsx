import { Skeleton } from '@/components/ui/Skeleton';

export default function CaptureLoading() {
  return (
    <div className="page-with-nav max-w-2xl mx-auto px-4 py-8">
      <Skeleton className="h-6 w-40 mb-6" />
      <Skeleton className="h-32 w-full mb-4" />
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    </div>
  );
}

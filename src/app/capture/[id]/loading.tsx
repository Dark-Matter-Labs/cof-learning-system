import { Skeleton } from '@/components/ui/Skeleton';

export default function CaptureDetailLoading() {
  return (
    <div className="page-with-nav max-w-2xl mx-auto px-4 py-8">
      <Skeleton className="h-5 w-24 mb-6" />
      <Skeleton className="h-7 w-64 mb-2" />
      <Skeleton className="h-4 w-full mb-1" />
      <Skeleton className="h-4 w-3/4 mb-6" />
      <Skeleton className="h-48 w-full" />
    </div>
  );
}
